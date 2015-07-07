(function() {
	var Map = global.Map;

	if (!Map) {
		var Dictionary = cellx.Dictionary;

		var entryStub = { value: undefined };

		Map = function Map(arr) {
			this._entries = new Dictionary();
			this._objectStamps = {};

			this._first = null;
			this._last = null;

			this.size = 0;

			if (arr) {
				for (var i = 0, l = arr.length; i < l; i++) {
					this.set(arr[i][0], arr[i][1]);
				}
			}
		};

		assign(Map.prototype, {
			has: function(key) {
				return !!this._entries[this._getValueStamp(key)];
			},

			get: function(key) {
				return (this._entries[this._getValueStamp(key)] || entryStub).value;
			},

			set: function(key, value) {
				var entries = this._entries;
				var keyStamp = this._getValueStamp(key);

				if (entries[keyStamp]) {
					entries[keyStamp].value = value;
				} else {
					var entry = entries[keyStamp] = {
						key: key,
						keyStamp: keyStamp,
						value: value,
						prev: this._last,
						next: null
					};

					if (this.size++) {
						this._last.next = entry;
					} else {
						this._first = entry;
					}

					this._last = entry;
				}

				return this;
			},

			'delete': function(key) {
				var keyStamp = this._getValueStamp(key);
				var entry = this._entries[keyStamp];

				if (!entry) {
					return false;
				}

				if (--this.size) {
					var prev = entry.prev;
					var next = entry.next;

					if (prev) {
						prev.next = next;
					} else {
						this._first = next;
					}

					if (next) {
						next.prev = prev;
					} else {
						this._last = prev;
					}
				} else {
					this._first = null;
					this._last = null;
				}

				delete this._entries[keyStamp];
				delete this._objectStamps[keyStamp];

				return true;
			},

			clear: function() {
				var entries = this._entries;

				for (var stamp in entries) {
					delete entries[stamp];
				}

				this._objectStamps = {};

				this._first = null;
				this._last = null;

				this.size = 0;
			},

			_getValueStamp: function(value) {
				switch (typeof value) {
					case 'undefined': {
						return 'undefined';
					}
					case 'object': {
						if (value === null) {
							return 'null';
						}

						break;
					}
					case 'boolean': {
						return '?' + value;
					}
					case 'number': {
						return '+' + value;
					}
					case 'string': {
						return ',' + value;
					}
				}

				return this._getObjectStamp(value);
			},

			_getObjectStamp: (function() {
				// for non-extensible objects and IE8
				function getObjectStamp(obj) {
					var stamps = this._objectStamps;
					var stamp;

					for (stamp in stamps) {
						if (stamps[stamp] == obj) {
							return stamp;
						}
					}

					stamp = String(++uidCounter);
					stamps[stamp] = obj;
					return stamp;
				}

				if (
					Object.defineProperty && isNative(Object.defineProperty) &&
						Object.isExtensible && isNative(Object.isExtensible)
				) {
					return function(obj) {
						if (!hasOwn.call(obj, KEY_UID)) {
							if (!Object.isExtensible(obj)) {
								return getObjectStamp.call(this, obj);
							}

							Object.defineProperty(obj, KEY_UID, {
								value: String(++uidCounter)
							});
						}

						return obj[KEY_UID];
					};
				}

				return getObjectStamp;
			})(),

			forEach: function(cb, context) {
				if (context == null) {
					context = global;
				}

				var entry = this._first;

				while (entry) {
					cb.call(context, entry.value, entry.key, this);

					do {
						entry = entry.next;
					} while (entry && !this._entries[entry.keyStamp]);
				}
			},

			toString: function() {
				return '[object Map]';
			}
		});

		var iterators = [
			['keys', function(entry) {
				return entry.key;
			}],
			['values', function(entry) {
				return entry.value;
			}],
			['entries', function(entry) {
				return [entry.key, entry.value];
			}]
		];

		for (var i = 0, l = iterators.length; i < l; i++) {
			Map.prototype[iterators[i][0]] = (function(getStepValue) {
				return function() {
					var entries = this._entries;
					var entry;
					var done = false;
					var map = this;

					return {
						next: function() {
							if (!done) {
								if (entry) {
									do {
										entry = entry.next;
									} while (entry && !entries[entry.keyStamp]);
								} else {
									entry = map._first;
								}

								if (entry) {
									return {
										value: getStepValue(entry),
										done: false
									};
								}

								done = true;
							}

							return {
								value: undefined,
								done: true
							};
						}
					};
				};
			})(iterators[i][1]);
		}
	}

	cellx.Map = Map;
})();