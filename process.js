var reflowsterKey = require("./credentials/reflowsterMacrofab.js").key;
var flickerstripKey = require("./credentials/flickerstripMacrofab.js").key;
var ordoroCredentials = require("./credentials/ordoro.js");

var ord = require("./ordoro");
var ordoro = new ord(ordoroCredentials);
var macrofab = require("./macrofab");
var reflowsterMacrofab = new macrofab(reflowsterKey);
var flickerstripMacrofab = new macrofab(flickerstripKey);

var util = require("util");
var _ = require("lodash");

var force = false;
if (process.env.FORCE) force=true;

var skuMap = {
    "HBFS-K-STARTER-IP65":{
        "HBFS-K-CTRL":1,
        "HBFS-L-IP65-30-3M":1,
    },
    "HBFS-K-STARTER-IP67":{
        "HBFS-K-CTRL":1,
        "HBFS-L-IP67-30-3M":1,
    },
    "HBFS-K-STARTER-IP67":{
        "HBFS-K-CTRL":1,
        "HBFS-L-IP67-30-3M":1,
    },
    "HBRF-K-REFL-US":{
        "HBRF-K-REFL":1,
        "HBRF-M-ACBUNDLE":1,
    },
    "RFL1a r2":{
        "HBRF-K-REFL":1,
    },
}

//var noStock = [ "HBFS-L-IP67-30-3M" ];
var noStock = [];

function convertItems(lines) {
    var items = {};
    _.each(lines,function(item) {
        var replacement = skuMap[item.product.sku];
        if (replacement) {
            _.each(replacement,function(qty,sku) {
                if (items[sku] === undefined) items[sku] = 0;
                items[sku] += qty;
            });
        } else {
            if (items[item.product.sku] === undefined) items[item.product.sku] = 0;
            items[item.product.sku] += item.quantity;
        }
    });
    return items;
}

function ordersToTSV(orders) {
    var out = "";
    _.each(orders,function(o) {
        var ship = o.shipping_address;
        var fields = [ship.name,ship.company,ship.phone,ship.email,"",ship.street1,ship.street2,ship.city,ship.state,ship.zip,ship.country,"","","","","Customs","Carrier","Service"];

        var items = convertItems(o.lines);
        _.each(items,function(qty,sku) {
            fields.push(sku,qty+"");
        });
        out += fields.join("\t") + "\n";
    });
    return out.substring(0,out.length-1);
}

function processOrders(mf,ordoro) {
    return new Promise(function(resolve,reject) {
        mf.loadProducts(function(products) {
            ordoro.getProcessingOrders(function(err,orders) {
                orders = _.reject(orders,(o) => _.find(o.tags,{text:"exported"})); //reject exported orders
                orders = _.reject(orders,(o) => _.filter(_.keys(convertItems(o.lines)),(k) => products[k]).length == 0); //reject orders that cant be fulfilled by this shop
                if (orders.length == 0) {
                    console.log("   No orders to fulfill");
                    return resolve();
                }
                _.each(orders,function(o) {
                    var items = convertItems(o.lines);

                    var missingItems = _.intersection(_.keys(items),noStock);
                    if (missingItems.length > 0) {
                        console.log("   Cannot fulfill "+o.order_id+" to "+o.shipping_address.name+" (missing: "+missingItems.join(", ")+")");
                        return;
                    }

                    console.log("   Processing order: "+o.order_id);
                    mf.createFulfillment(o,items,force,function(id) {
                        console.log("   Created Fulfillment Request: "+id);
                        ordoro.tagExported(o.order_id,function() {
                            resolve();
                        });
                    });
                });
            });
        });
    });
}


var cmd = process.argv[2];
if (cmd === "print") {
    ordoro.getNewOrders(function(err,orders) {
        orders = _.filter(orders,{"cart_name":"hohmbody.myshopify.com"});
        var tsv = ordersToTSV(orders);
        console.log(tsv);
    });
} else if (cmd === "process") {
    console.log("Reflowster");
    processOrders(reflowsterMacrofab,ordoro).then(function() {
        console.log("Flickerstrip");
        processOrders(flickerstripMacrofab,ordoro);
    });
} else if (cmd === "test") {
    ordoro.getProcessingOrders(function(err,orders) {
        orders = _.filter(orders,{"cart_name":"Reflowster Store"});
        orders = _.reject(orders,(o) => _.find(o.tags,{text:"exported"})); //reject exported orders
        //var tsv = ordersToTSV(orders);
        //console.log(tsv);
        _.each(orders,function(order) {
            ordoro.tagExported(order.order_id,function() {
                console.log("Exported",order.order_id);
            });
        });
    });
}
