var bluebird = require('bluebird');
var crypto = require('crypto');
var msgpack = require('msgpack5')();

function RedisReady(options) {
    var defaultCache = 1024 * 1024 * 32;
    this._cache = {};
    this._first = null;
    this._last = null;

    if (typeof options === "object") {
        if (typeof options.size !== "number") {
            // Default to 32MiB of cache
            options.size = defaultCache;
        }
        if (typeof options.redis !== "boolean") {
            options.redis = false;
        }
    }
    else {
        var options = {
            size: defaultCache,
            redis: false
        };
    }
    this._maxSpace = options.size;
    this._spaceRemaining = options.size;
    this._hashingAlgo = crypto.getHashes().indexOf('sha1') !== -1 ? 'sha1' : 'sha256';
}

/**
 * @summary - Returns the total size of an element
 *
 * @description - This lazily assumes that all objects have non-null
 * keys. This is mostly done to create cleaner code,it additionally prevents v8 from having
 * to do multiple allocs / deallocs for a given change.
 */
RedisReady.prototype.computeSize = function(element) {
    return element.blob.length + ((this._hashingAlgo === 'sha1' ? 28 : 44) * 2) ;
}

RedisReady.prototype.debugCache = function(key) {
    if (process.env.NODE_ENV !== "development") {
        console.trace("Attempted to run debug cache on non-development environment.");
        return false;
    } else if (key === undefined) {
        console.log(JSON.stringify(this._cache, null, 4));
        console.log("Space Remaining: " + this._spaceRemaining);
        return {
            remaining: this._spaceRemaining,
            _first: this._first,
            _last: this._last
        }
    } else {
        var key = crypto.createHash(this._hashingAlgo).update(key).digest('base64');
        return {
            key: key,
            value: this._cache[key]
        };
    }
}

RedisReady.prototype.ensureSpace = function(key, size) {
    if (this._spaceRemaining >= size) {
        return this._spaceRemaining - size;
    } else if (this._maxSpace - size < 0) {
        console.log("Error when attempting to cache " + key + ":" + " element is larger than cache size.");
        return -1;
    }

    var needed = size - this._spaceRemaining;
    while (needed >= 0) {
        if (this._spaceRemaining === this._maxSpace) {
            return;
        }
        var lastKey = this.getLastElementKey();

        var element = this._cache[lastKey];
        var size = element.blob.length;
        needed -= size;
        this._spaceRemaining += size;
        this._updateLinks(lastKey, element.previous, element.next);
        delete this._cache[lastKey];
    }

    return this._spaceRemaining;
}

RedisReady.prototype.get = function(key, callback) {
    var key = crypto.createHash(this._hashingAlgo).update(key).digest('base64');
    if (!this._cache.hasOwnProperty(key)) {
        return;
    }

    var element = this._cache[key];

    if (this._first !== key) {
        if (key === this._last) {
            this._last = element.next;
            this._cache[this._last].previous = null;
        }
        else {
            // Update previous element's reference to new reference
            this._cache[element.previous].next = element.next;
        }
        // Update next cached elements previous value to new reference
        this._cache[element.next].previous = element.previous;

        // Set this element to head of cache
        this._cache[this._first].next = key;
        element.previous = this._first;
        element.next = null;
        this._first = key;
    }

    return msgpack.decode(element.blob);
}

RedisReady.prototype.getLastElementKey = function() {
    if (this._last === null) {
        for (var p in this._cache) {
            if (this._cache[p].next === null) {
                return p;
            }
        }
    }

    return this._last;
}

RedisReady.prototype.set = function(key, value, callback) {
    var key = crypto.createHash(this._hashingAlgo).update(key).digest('base64');
    var element = {
        blob: msgpack.encode(value),
        next: null,
        previous: null
    };

    if (this._cache.hasOwnProperty(key)) {
        element = {
            blob: element.blob,
            next: this._cache[key].next,
            previous: this._cache[key].previous
        }

        // If it's already the most recently accessed, update storage and return
        if (key === this._first) {
            // Since no keys have changed, we can just update to reflect new blob size;
            this._spaceRemaining += this.computeSize(this._cache[key]);
            this._updateCache(key, element);
            return value;
        }

        this._updateLinks(key, element.previous, element.next)
    }

    // Cache the new key since it does not exist
    this._updateCache(key, element);

    // Update linked list
    element.next = null;
    element.previous = this._first;

    if (this._first !== null) {
        this._cache[this._first].next = key;
    }
    this._first = key;

    if (!this._previous) {
        this._previous = key;
    }
    return value;
}

RedisReady.prototype._updateCache = function(key, element) {
    var size = this.computeSize(element);
    this.ensureSpace(key, size);
    this._spaceRemaining -= size;
    this._cache[key] = element;
}

RedisReady.prototype._updateLinks = function(key, previous, next) {
    if (this._first === key) {
        this._first = previous;
        this._cache[this._first].next = null;
    }
    else if (this._last === key) {
        this._last = next;
        this._cache[this._last].previous = null;
    }
    else {
        this._cache[previous].next = next;
        this._cache[next].previous = previous;
    }
}

module.exports = RedisReady;