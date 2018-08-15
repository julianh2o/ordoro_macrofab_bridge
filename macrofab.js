var request = require('request');
var _ = require("lodash");
var util = require("util");


function This() {
    this.init.apply(this,arguments);
}

_.extend(This.prototype,{
    init: function(key) {
        this.apiKey = key;
        this.productSkuMap = {};
    },
    sendPut(url,data) {
        return new Promise(function(resolve, reject) {
            var nopt = _.extend({},{
                method:"PUT",
                uri:url,
            });
            if (data) nopt["json"] = data;
            request(nopt,function(error,response,body) {
                if (error) reject(error,response,body);
                resolve(body);
            });
        });
    },
    sendPost(url,data) {
        return new Promise(function(resolve, reject) {
            var nopt = _.extend({},{
                method:"POST",
                uri:url,
            });
            if (data) nopt["json"] = data;
            request(nopt,function(error,response,body) {
                if (error) reject(error,response,body);
                resolve(body);
            });
        });
    },
    get(url) {
        return new Promise(function(resolve,reject) {
            var opt = {
                url: url,
                headers: {
                    "Accept":"application/json",
                }
            }
            request.get(opt,function(err,response,body) {
                if (err) return reject(err,response);
                resolve(JSON.parse(body));
            });
        });
    },
    fulfillmentFromOrder(o) {
        var ship = o.shipping_address;
        return {
            "customer_name":ship.name,
            "company":ship.company,
            "phone_number":ship.phone,
            "email":ship.email,
            "po_number":"",
            "address1":ship.street1,
            "address2":ship.street2,
            "city":ship.city,
            "state":ship.state,
            "zip_code":ship.zip,
            "country":ship.country,
            "status":"new",
        }
    },
    createFulfillment(o,items,force,cb) {
        var fulfillment = this.fulfillmentFromOrder(o);
        if (force) fulfillment["force_validation"] = 1;
        this.sendPost("https://api.macrofab.com/api/v2/fulfillment?apikey="+this.apiKey,{"fulfillment_request":fulfillment}).then(function(body) {
            if (!body.fulfillment_request) console.log("ERR: ",body.message,fulfillment);
            var requestId = body.fulfillment_request.fulfillment_request_id;

            var promises = [];
            _.each(items,function(qty,sku) {
                if (this.productSkuMap[sku] === undefined) {
                    console.log("SKU not found: ",sku);
                    return;
                }
                var opt = {
                    "fulfillment_product":{
                        "product_id":this.productSkuMap[sku],
                        "count":qty,
                    }
                }
                var p = this.sendPost("https://api.macrofab.com/api/v2/fulfillment/"+requestId+"/product?apikey="+this.apiKey,opt);
                promises.push(p);
            }.bind(this));
            Promise.all(promises).then(function() {
                this.sendPut("https://api.macrofab.com/api/v2/fulfillment/"+requestId+"?apikey="+this.apiKey,{"fulfillment_request":{"status":"approved"}}).then(function(body) {
                    if (cb) cb(requestId);
                });
                /*
                console.log("added products");
                get("https://api.macrofab.com/api/v2/fulfillment/"+requestId+"/quote?apikey="+apikey).then(function(quote) {
                    console.log("got quote",util.inspect(quote,true,null));
                    _.each(quote.charges.shipment.rates,function(rate) {
                        console.log(rate.list_rate,rate.retail_rate,rate.carrier,rate.service);
                    });
                });
                */
            }.bind(this));
        }.bind(this)).catch(function() {console.log("err",arguments)});
    },
    getFulfillments(cb) {
        var opt = {
            url: "https://api.macrofab.com/api/v2/fulfillments?apikey="+this.apiKey,
            headers: {
                "Accept":"application/json",
            }
        }
        request.get(opt,function(err,response,body) {
            console.log("got fulfillments",err,body);
        });
    },
    getProducts(cb) {
        var opt = {
            url: "https://api.macrofab.com/api/v2/products?apikey="+this.apiKey,
            headers: {
                "Accept":"application/json",
            }
        }
        request.get(opt,function(err,response,body) {
            if (cb) cb(JSON.parse(body).products);
        });
    },
    loadProducts(cb) {
        this.productSkuMap = {};
        this.getProducts(function(products) {
            _.each(products,function(p) {
                this.productSkuMap[p.sku] = p.product_id;
            }.bind(this));
            if (cb) cb(this.productSkuMap);
        }.bind(this));
    },
    getOrders(cb) {
        this.get("https://api.macrofab.com/api/v2/orders?apikey="+this.apiKey).then(function(orders) {
            //console.log("got orders",util.inspect(orders.orders[0],true,null));
            console.log(_.keys(orders.orders[0]));
            _.each(orders.orders,function(o) {
                if (o.type == "fulfillment") {
                    var shippingTotal = 0;
                    var laborTotal = 0;
                    var paid = 0;
                    _.each(o.line_items,function(l) {
                        //console.log(l,_.keys(l).join(" "));
                        if (l.category == "labor") {
                            laborTotal += parseFloat(l.cost);
                        } else if (l.category == "shipping") {
                            console.log([o.order_id,o.type,o.created,l.cost].join(","));
                            shippingTotal += parseFloat(l.cost);
                        } else if (l.category == "payment") {
                            paid += parseFloat(l.cost);
                        }
                    });
                    //console.log(paid,shippingTotal,laborTotal);
                    var overpaid = paid - (shippingTotal + laborTotal);
                }
            });
        });
    }
});

module.exports = This;
