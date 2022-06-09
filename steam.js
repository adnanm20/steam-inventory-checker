var https = require("https");
var fs = require("fs");

class Item  {
	constructor(name, type, market_name, classid, amount = 1) {
		this.name = name;
		this.type = type;
		this.market_name = market_name;
		this.marketid = "";
		this.classid = classid;
		this.amount = amount;
		this.buypricesum = 0;
		this.priceofone = 0;
		this.priceofall = this.amount * this.priceofone;
	}
}

//small function to get a pretty name without the prefixes like Sticker | name_of_sticker and Sealed Graffiti | name_of_graffiti
function getItemName(market_name, type) {
	switch(type) {
		case "Graffiti":
			return market_name.split(" | ")[1];
		case "Sticker":
			return market_name.split("Sticker | ")[1];
		default:
			return market_name;
	}
}

inventory = [];
//keep this always on
loadInventoryItems();

//call the first one when changes to inventory are made, it does everything
updateInventoryItems();

let factor = 100;
//call this one when you know there have been to changes to the inventory but you just need the current prices
//it's called from printInventory() automatically so you don't need to worry if the prices are new or old
//updatePrices(0);

//you most likely will never call these two because they're called from the ones above
//updatePriceSums();
//saveInventoryItems();


//don't call this function at all please
//getAllMarketIDs(0 + factor * 15);




//inventory handling functions below

//simple, does what it says
function loadInventoryItems() {
	try {
		text = fs.readFileSync('inventory.txt', 'utf8')
		}	catch (err) {
			console.error(err)
		}

	inventory = JSON.parse(text);
}

//simple, does what it says
function saveInventoryItems() {
	fs.writeFile("inventory.txt", JSON.stringify(inventory), err => {
		if(err) {
			console.error(err)
			return;
		}
		console.log("Inventory successfully saved!");
	});
}

//just set all the priceofall stats
//rounded to 2 decimals
function updatePriceSums() {
	inventory.forEach(item => {
		item.priceofall = Math.floor(item.amount * item.priceofone * 100) / 100;
	});
}

//this gets all items in the csgo inventory of a steam user
//pretty neat of steam to store all of your items into one json file with a lot of useful information
//just make sure to have the count variable higher than number of items in your inventory
//>1000 should be good for everyone because max number of items in csgo inventory is 1000 I think
function updateInventoryItems() {
	inventory.forEach(item => {
		item.amount = 0;
	});

	var options = { 
		hostname: 'steamcommunity.com',
		path: '/inventory/#steamidofyouraccount#/730/2?l=english&count=2000',
		method: 'GET',
		headers: {
		}
	};
		
	var req = https.request(options, res => {
		console.log(res.statusCode);
		let response = "";
	
		res.on('data', d => {
			response += d;
		});
	
		res.on("end", async () => {
			data = JSON.parse(response);
	
			data.assets.forEach(item => {
				i = inventory.findIndex(el => el.classid == item.classid);
				if (i > -1) {
					inventory[i].amount++;
				}
				else {
					i = data.descriptions.findIndex(el => el.marketable && el.classid == item.classid);
	
					if(i > -1)
					{
						item = data.descriptions[i];
						inventory.push(new Item(getItemName(item.market_name, item.tags[0].localized_tag_name), item.tags[0].localized_tag_name, item.market_name, item.classid));
						console.log("Placed new item in inventory: " + item.market_name);
					}
				}
			});
			const r = await getAllMarketIDs(0);
			updatePrices(0);
		});
	});
	
	req.end();
}

//makes the name url compatible
function getMarketHashName(market_name) {
	return market_name.replace(/ /g, "%20").replace(/\|/g, "%7C").replace(/\u2122/g, "%E2%84%A2");
}

//test();

async function test() {
	console.log(1);
	getMarketID("Fracture Case", 1, _callback);
	function _callback() {
		console.log(2);
	}
}

//this gets all the prices of different items in the inventory
//nothing fancy just getting the data same place all the items market pages get it from
function updatePrices(itemIndex) {
	if(itemIndex >= (inventory.length > (15 + factor * 15) ? (15 + factor * 15) : inventory.length))
	{
		updatePriceSums();
		saveInventoryItems();
		return;
	}

	var options = { 
		hostname: 'steamcommunity.com',
		path: '/market/itemordershistogram?country=BA&language=english&currency=3&item_nameid=' + inventory[itemIndex].marketid.toString() + '&two_factor=0',
		method: 'GET',
		headers: {
		}
	};
		
	var req = https.request(options, res => {
		console.log("Status code for price update " + res.statusCode);
		let response = "";
	
		res.on('data', d => {
			response += d;
		});
	
		res.on("end", async () => {
			data = JSON.parse(response);
			console.log(data.sell_order_graph[0][0]);
			inventory[itemIndex].priceofone = data.sell_order_graph[0][0];
			console.log("Updated price for " + inventory[itemIndex].name);
			updatePrices(++itemIndex);
		});
	});
			
	req.end();
}

//gets the market ids to get prices which are different to all other ids for some reason
//market ids are found whenever you call the exact market page of the item and apparently nowhere else
//this needs fixing if you want to check for random accounts
//it is very slow but I use it because steam only limits getting the ids and not the prices
//using /market/priceoverview endpoint does get you prices with just market names of items but is rate limited
//I'd rather wait a bit when loading a new inventory or updating old rather than waiting every time I want to check the value
async function getAllMarketIDs(itemIndex) {
	if(itemIndex >= (inventory.length > (0 + factor * 15) ? (0 + factor * 15) : inventory.length))
	{
		saveInventoryItems();
		return;
	}

	if(inventory[itemIndex].marketid != "")
	{
		getAllMarketIDs(++itemIndex);
		return;
	}

	console.log(itemIndex);
	var options = { 
		hostname: 'steamcommunity.com',
		path: '/market/listings/730/' + getMarketHashName(inventory[itemIndex].market_name),
		method: 'GET',
		headers: {
		}
	};
		
	var req = https.request(options, res => {
		console.log("Status code for market IDs " + res.statusCode);
		let response = "";
	
		res.on('data', d => {
			response += d.toString();
		});
	
		res.on("end", async () => {
			let re = new RegExp(/Market_LoadOrderSpread\( (\d*)/);
			inventory[itemIndex].marketid = response.match(re)[1].toString();
			console.log("saved id for " + inventory[itemIndex].name);
			await new Promise(resolve => setTimeout(resolve, 4000));
			getAllMarketIDs(++itemIndex);
		});
	});
			
	req.end();	
}
