var request = require('request');
var _ = require("lodash");


function This() {
    this.init.apply(this,arguments);
}

_.extend(This.prototype,{
    init: function(credentials) {
        this.credentials = credentials;
    },
    getNewOrders: function(cb) {
        this.requestPages("https://api.ordoro.com/order/?status=all","order",cb);
    },
    getProcessingOrders: function(cb) {
        this.requestPages("https://api.ordoro.com/order/?status=in_process","order",cb);
    },
    updateQueryString(key, value, url) {
        var re = new RegExp("([?&])" + key + "=.*?(&|#|$)(.*)", "gi"),
            hash;

        if (re.test(url)) {
            if (typeof value !== 'undefined' && value !== null)
                return url.replace(re, '$1' + key + "=" + value + '$2$3');
            else {
                hash = url.split('#');
                url = hash[0].replace(re, '$1$3').replace(/(&|\?)$/, '');
                if (typeof hash[1] !== 'undefined' && hash[1] !== null) 
                    url += '#' + hash[1];
                return url;
            }
        }
        else {
            if (typeof value !== 'undefined' && value !== null) {
                var separator = url.indexOf('?') !== -1 ? '&' : '?';
                hash = url.split('#');
                url = hash[0] + separator + key + '=' + value;
                if (typeof hash[1] !== 'undefined' && hash[1] !== null) 
                    url += '#' + hash[1];
                return url;
            }
            else
                return url;
        }
    },
    requestPages(url,key,cb) {
        var items = [];
        var fetchPages = function(offset) {
            var pageurl = this.updateQueryString("offset",offset,url);
            var opt = {'auth':{'user':this.credentials.user,'pass':this.credentials.password}};
            request.get(pageurl,opt,function(error,response,body) {
                var json = JSON.parse(body);
                if (body.indexOf("error_message") && !json[key]) {
                    console.log("Error while loading page: ",body);
                    if (cb) cb(body,[]);
                    return;
                }
                var done = offset+json.limit > json.count;
                items = items.concat(json[key]);
                if (done) {
                    cb(null,items);
                } else {
                    fetchPages(offset+json.limit);
                }
            });
        }.bind(this);

        fetchPages(0);
    },
    sendPost(url,data,cb) {
        var nopt = {
            'auth':{'user':this.credentials.user,'pass':this.credentials.password},
            method:"POST",
            uri:url,
            headers: {
                'Content-Type': 'application/json'
            },
        };
        if (data) nopt["json"] = data;
        request(nopt,function(error,response,body) {
            if (cb) cb(error,body);
        });
    },
    processOrder(orderId,cb) {
        this.sendPost("https://api.ordoro.com/order/"+orderId+"/create_shipment/",null,cb);
    },
    tagExported(orderId,cb) {
        this.sendPost("https://api.ordoro.com/order/"+orderId+"/tag/11266/",null,cb);
    }
});

module.exports = This;
