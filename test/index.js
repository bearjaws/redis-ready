var redisready = require('../');
var cache = new redisready();
var chai = require('chai');
var expect = chai.expect;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

describe('First element inserted', function() {
    it('should let me set and retrieve an item from cache', function() {
        expect(cache.get('test')).to.be.undefined;
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
        expect(cache.get('newTest')).to.be.undefined;
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

describe('Third element inserted', function() {
    it('should let me set and retrieve an item from cache', function() {
        expect(cache.get('newTest2')).to.be.undefined;
        cache.set('newTest2', {"testing": "attention please"});
        expect(cache.get('newTest2')).to.not.be.undefined;
    });

    it('should not have a next value, but should have a previous values', function() {
        var debug = cache.debugCache('newTest2');
        var previous = cache.debugCache('newTest');
        expect(debug.value.next).to.be.null;
        expect(debug.value.previous).to.equal(previous.key);
    });

    it('should have updated the previously set key to be second to last', function() {
        var current = cache.debugCache('newTest2');
        var previous = cache.debugCache('newTest');
        var last = cache.debugCache('test');
        expect(current.value.next).to.be.null;
        expect(current.value.previous).to.equal(previous.key);
        expect(previous.value.previous).to.equal(last.key);
    });
});
