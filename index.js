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
}

RedisReady.prototype.debugCache = function() {
    if (process.env.NODE_ENV !== "production") {
        console.log(JSON.stringify(this._cache, null, 4));
        console.log(this._spaceRemaining);
    }
    else {
        console.stack("Attempted to run debug cache on production environment.");
    }
}

RedisReady.prototype.ensureSpace = function(key, size) {
    console.log("Ensuring Space for " + key + " total size " + size);
    if (this._spaceRemaining >= size) {
        return this._spaceRemaining - size;
    } else if (this._maxSpace - size < 0) {
        console.log("Error when attempting to cache " + key + ":" + " element is larger than cache size.");
        return -1;
    }

    var needed = size - this._spaceRemaining;
        console.log('need', size - this._spaceRemaining);
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

RedisReady.prototype.get = function(key) {
    var key = crypto.createHash('sha256').update(key).digest('base64');
    console.log(key.length);
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

RedisReady.prototype.set = function(key, value) {
    var key = crypto.createHash('sha256').update(key).digest('base64');

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
            this._spaceRemaining -= element.blob.length;
            this._spaceRemaining += this._cache[key].blob.length;
            this.ensureSpace(key, element.blob.length);
            this._cache[key] = element;
            return value;
        }

        this._updateLinks(key, element.previous, element.next)
    } else {
        this.ensureSpace(key, element.blob.length);
        this._cache[key] = element;
    }

    element.next = null;
    element.previous = this._first;

    if (this._first) {
        this._cache[this._first].next = key;
    }
    this._first = key;

    if (!this._previous) {
        this._previous = key;
    }

    this._spaceRemaining -= element.blob.length;
    return value;
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