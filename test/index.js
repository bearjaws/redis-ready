var redisready = require('../');
var cache = new redisready();
var expect = require('chai').expect;

describe('First element inserted', function() {
    it('should let me set and retrieve an item from cache', function() {
        cache.set('test', {"derp": "herp"});
        expect(cache.get('test')).to.not.be.undefined;
    });

    it('should not have any first or next elements', function() {
        var debug = cache.debugCache('test');
        expect(debug.value.next).to.be.null;
        expect(debug.value.previous).to.be.null;
    });
});


describe('Second element inserted', function() {
    it('should let me set and retrieve an item from cache', function() {
        cache.set('newTest', {"testing": "attention please"});
        expect(cache.get('newTest')).to.not.be.undefined;
    });

    it('should not have a next value, but should have a previous values', function() {
        var debug = cache.debugCache('newTest');
        var previous = cache.debugCache('test');
        expect(debug.value.next).to.be.null;
        expect(debug.value.previous).to.equal(previous.key);
    });

    it('should have updated the previously set key to be last', function() {
        var debug = cache.debugCache('test');
        var next = cache.debugCache('newTest');
        expect(debug.value.next).to.equal(next.key);
        expect(debug.value.previous).to.be.a.string;
    });
});
