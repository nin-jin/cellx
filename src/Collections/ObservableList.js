import EventEmitter from '../EventEmitter';
import ObservableCollectionMixin from './ObservableCollectionMixin';
import { is } from '../JS/Object';
import { push, splice } from '../JS/Array';
import Symbol from '../JS/Symbol';

/**
 * @typesign (a, b) -> -1|1|0;
 */
function defaultComparator(a, b) {
	if (a < b) { return -1; }
	if (a > b) { return 1; }
	return 0;
}

/**
 * @class cellx.ObservableList
 * @extends {cellx.EventEmitter}
 * @implements {cellx.ObservableCollectionMixin}
 *
 * @typesign new ObservableList(items?: Array|cellx.ObservableList, opts?: {
 *     adoptsItemChanges?: boolean,
 *     comparator?: (a, b) -> int,
 *     sorted?: boolean
 * }) -> cellx.ObservableList;
 */
var ObservableList = EventEmitter.extend({
	Implements: [ObservableCollectionMixin],

	constructor: function ObservableList(items, opts) {
		EventEmitter.call(this);
		ObservableCollectionMixin.call(this);

		if (!opts) {
			opts = {};
		}

		this._items = [];

		this.length = 0;

		/**
		 * @type {boolean}
		 */
		this.adoptsItemChanges = opts.adoptsItemChanges !== false;

		/**
		 * @type {?(a, b) -> int}
		 */
		this.comparator = null;

		this.sorted = false;

		if (opts.sorted || (opts.comparator && opts.sorted !== false)) {
			this.comparator = opts.comparator || defaultComparator;
			this.sorted = true;
		}

		if (items) {
			this._addRange(items);
		}
	},

	/**
	 * @typesign (index: ?int, allowedEndIndex?: boolean) -> ?uint;
	 */
	_validateIndex: function _validateIndex(index, allowedEndIndex) {
		if (index === void 0) {
			return index;
		}

		if (index < 0) {
			index += this.length;

			if (index < 0) {
				throw new RangeError('Index out of valid range');
			}
		} else if (index >= (this.length + (allowedEndIndex ? 1 : 0))) {
			throw new RangeError('Index out of valid range');
		}

		return index;
	},

	/**
	 * @typesign (value) -> boolean;
	 */
	contains: function contains(value) {
		return this._valueCounts.has(value);
	},

	/**
	 * @typesign (value, fromIndex?: int) -> int;
	 */
	indexOf: function indexOf(value, fromIndex) {
		return this._items.indexOf(value, this._validateIndex(fromIndex));
	},

	/**
	 * @typesign (value, fromIndex?: int) -> int;
	 */
	lastIndexOf: function lastIndexOf(value, fromIndex) {
		return this._items.lastIndexOf(value, fromIndex === void 0 ? -1 : this._validateIndex(fromIndex));
	},

	/**
	 * @typesign (index: int) -> *;
	 */
	get: function get(index) {
		return this._items[this._validateIndex(index, true)];
	},

	/**
	 * @typesign (index: int, count?: uint) -> Array;
	 */
	getRange: function getRange(index, count) {
		index = this._validateIndex(index, true);

		var items = this._items;

		if (count === void 0) {
			return items.slice(index);
		}

		if (index + count > items.length) {
			throw new RangeError('Sum of "index" and "count" out of valid range');
		}

		return items.slice(index, index + count);
	},

	/**
	 * @typesign (index: int, value) -> cellx.ObservableList;
	 */
	set: function set(index, value) {
		if (this.sorted) {
			throw new TypeError('Cannot set to sorted list');
		}

		index = this._validateIndex(index);

		var items = this._items;

		if (is(value, items[index])) {
			return this;
		}

		this._unregisterValue(items[index]);
		this._registerValue(value);
		items[index] = value;

		this.emit('change');

		return this;
	},

	/**
	 * @typesign (index: int, values: Array|cellx.ObservableList) -> cellx.ObservableList;
	 */
	setRange: function setRange(index, values) {
		if (this.sorted) {
			throw new TypeError('Cannot set to sorted list');
		}

		index = this._validateIndex(index);

		if (values instanceof ObservableList) {
			values = values._items;
		}

		var valueCount = values.length;

		if (!valueCount) {
			return this;
		}

		if (index + valueCount > this.length) {
			throw new RangeError('Sum of "index" and "values.length" out of valid range');
		}

		var items = this._items;
		var changed = false;

		for (var i = index + valueCount; i > index;) {
			var value = values[--i - index];

			if (!is(value, items[i])) {
				this._unregisterValue(items[i]);
				this._registerValue(value);
				items[i] = value;
				changed = true;
			}
		}

		if (changed) {
			this.emit('change');
		}

		return this;
	},

	/**
	 * @typesign (value) -> cellx.ObservableList;
	 */
	add: function add(value) {
		if (this.sorted) {
			this._insertValue(value);
		} else {
			this._registerValue(value);
			this._items.push(value);
		}

		this.length++;

		this.emit('change');

		return this;
	},

	/**
	 * @typesign (values: Array|cellx.ObservableList) -> cellx.ObservableList;
	 */
	addRange: function addRange(values) {
		if (values.length) {
			this._addRange(values);
			this.emit('change');
		}

		return this;
	},

	/**
	 * @typesign (values: Array|cellx.ObservableList);
	 */
	_addRange: function _addRange(values) {
		if (values instanceof ObservableList) {
			values = values._items;
		}

		if (this.sorted) {
			for (var i = 0, l = values.length; i < l; i++) {
				this._insertValue(values[i]);
			}

			this.length += values.length;
		} else {
			for (var j = values.length; j;) {
				this._registerValue(values[--j]);
			}

			this.length = push.apply(this._items, values);
		}
	},

	/**
	 * @typesign (value);
	 */
	_insertValue: function _insertValue(value) {
		this._registerValue(value);

		var items = this._items;
		var comparator = this.comparator;
		var low = 0;
		var high = items.length;

		while (low != high) {
			var mid = (low + high) >> 1;

			if (comparator(value, items[mid]) < 0) {
				high = mid;
			} else {
				low = mid + 1;
			}
		}

		items.splice(low, 0, value);
	},

	/**
	 * @typesign (index: int, value) -> cellx.ObservableList;
	 */
	insert: function insert(index, value) {
		if (this.sorted) {
			throw new TypeError('Cannot insert to sorted list');
		}

		index = this._validateIndex(index, true);

		this._registerValue(value);
		this._items.splice(index, 0, value);
		this.length++;

		this.emit('change');

		return this;
	},

	/**
	 * @typesign (index: int, values: Array|cellx.ObservableList) -> cellx.ObservableList;
	 */
	insertRange: function insertRange(index, values) {
		if (this.sorted) {
			throw new TypeError('Cannot insert to sorted list');
		}

		index = this._validateIndex(index, true);

		if (values instanceof ObservableList) {
			values = values._items;
		}

		var valueCount = values.length;

		if (!valueCount) {
			return this;
		}

		for (var i = valueCount; i;) {
			this._registerValue(values[--i]);
		}

		splice.apply(this._items, [index, 0].concat(values));
		this.length += valueCount;

		this.emit('change');

		return this;
	},

	/**
	 * @typesign (value, fromIndex?: int) -> boolean;
	 */
	remove: function remove(value, fromIndex) {
		var index = this._items.indexOf(value, this._validateIndex(fromIndex));

		if (index == -1) {
			return false;
		}

		this._unregisterValue(value);
		this._items.splice(index, 1);
		this.length--;

		this.emit('change');

		return true;
	},

	/**
	 * @typesign (value, fromIndex?: int) -> boolean;
	 */
	removeAll: function removeAll(value, fromIndex) {
		var index = this._validateIndex(fromIndex);
		var items = this._items;
		var changed = false;

		while ((index = items.indexOf(value, index)) != -1) {
			this._unregisterValue(value);
			items.splice(index, 1);
			changed = true;
		}

		if (changed) {
			this.length = items.length;
			this.emit('change');
		}

		return changed;
	},

	/**
	 * @typesign (values: Array|cellx.ObservableList, fromIndex?: int) -> boolean;
	 */
	removeEach: function removeEach(values, fromIndex) {
		fromIndex = this._validateIndex(fromIndex);

		if (values instanceof ObservableList) {
			values = values._items;
		}

		var items = this._items;
		var changed = false;

		for (var i = 0, l = values.length; i < l; i++) {
			var value = values[i];
			var index = items.indexOf(value, fromIndex);

			if (index != -1) {
				this._unregisterValue(value);
				items.splice(index, 1);
				changed = true;
			}
		}

		if (changed) {
			this.length = items.length;
			this.emit('change');
		}

		return changed;
	},

	/**
	 * @typesign (values: Array|cellx.ObservableList, fromIndex?: int) -> boolean;
	 */
	removeAllEach: function removeAllEach(values, fromIndex) {
		fromIndex = this._validateIndex(fromIndex);

		if (values instanceof ObservableList) {
			values = values._items;
		}

		var items = this._items;
		var changed = false;

		for (var i = 0, l = values.length; i < l; i++) {
			var value = values[i];

			for (var index = fromIndex; (index = items.indexOf(value, index)) != -1;) {
				this._unregisterValue(value);
				items.splice(index, 1);
				changed = true;
			}
		}

		if (changed) {
			this.length = items.length;
			this.emit('change');
		}

		return changed;
	},

	/**
	 * @typesign (index: int) -> *;
	 */
	removeAt: function removeAt(index) {
		var value = this._items.splice(this._validateIndex(index), 1)[0];
		this._unregisterValue(value);
		this.length--;

		this.emit('change');

		return value;
	},

	/**
	 * @typesign (index: int, count?: uint) -> Array;
	 */
	removeRange: function removeRange(index, count) {
		index = this._validateIndex(index, true);

		var items = this._items;

		if (count === void 0) {
			count = items.length - index;
		} else if (index + count > items.length) {
			throw new RangeError('Sum of "index" and "count" out of valid range');
		}

		if (!count) {
			return [];
		}

		for (var i = index + count; i > index;) {
			this._unregisterValue(items[--i]);
		}
		var values = items.splice(index, count);
		this.length -= count;

		this.emit('change');

		return values;
	},

	/**
	 * @typesign () -> cellx.ObservableList;
	 */
	clear: function clear() {
		if (!this.length) {
			return this;
		}

		if (this.adoptsItemChanges) {
			this._valueCounts.forEach(function(value) {
				if (value instanceof EventEmitter) {
					value.off('change', this._onItemChange, this);
				}
			}, this);
		}

		this._items.length = 0;
		this._valueCounts.clear();

		this.length = 0;

		this.emit('change');

		return this;
	},

	/**
	 * @typesign (separator?: string) -> string;
	 */
	join: function join(separator) {
		return this._items.join(separator);
	},

	/**
	 * @typesign (
	 *     cb: (item, index: uint, list: cellx.ObservableList),
	 *     context?
	 * );
	 */
	forEach: null,

	/**
	 * @typesign (
	 *     cb: (item, index: uint, list: cellx.ObservableList) -> *,
	 *     context?
	 * ) -> Array;
	 */
	map: null,

	/**
	 * @typesign (
	 *     cb: (item, index: uint, list: cellx.ObservableList) -> ?boolean,
	 *     context?
	 * ) -> Array;
	 */
	filter: null,

	/**
	 * @typesign (
	 *     cb: (item, index: uint, list: cellx.ObservableList) -> ?boolean,
	 *     context?
	 * ) -> *;
	 */
	find: function(cb, context) {
		var items = this._items;

		for (var i = 0, l = items.length; i < l; i++) {
			var item = items[i];

			if (cb.call(context, item, i, this)) {
				return item;
			}
		}
	},

	/**
	 * @typesign (
	 *     cb: (item, index: uint, list: cellx.ObservableList) -> ?boolean,
	 *     context?
	 * ) -> int;
	 */
	findIndex: function(cb, context) {
		var items = this._items;

		for (var i = 0, l = items.length; i < l; i++) {
			if (cb.call(context, items[i], i, this)) {
				return i;
			}
		}

		return -1;
	},

	/**
	 * @typesign (
	 *     cb: (item, index: uint, list: cellx.ObservableList) -> ?boolean,
	 *     context?
	 * ) -> boolean;
	 */
	every: null,

	/**
	 * @typesign (
	 *     cb: (item, index: uint, list: cellx.ObservableList) -> ?boolean,
	 *     context?
	 * ) -> boolean;
	 */
	some: null,

	/**
	 * @typesign (
	 *     cb: (accumulator, item, index: uint, list: cellx.ObservableList) -> *,
	 *     initialValue?
	 * ) -> *;
	 */
	reduce: null,

	/**
	 * @typesign (
	 *     cb: (accumulator, item, index: uint, list: cellx.ObservableList) -> *,
	 *     initialValue?
	 * ) -> *;
	 */
	reduceRight: null,

	/**
	 * @typesign () -> cellx.ObservableList;
	 */
	clone: function clone() {
		return new this.constructor(this, {
			adoptsItemChanges: this.adoptsItemChanges,
			comparator: this.comparator,
			sorted: this.sorted
		});
	},

	/**
	 * @typesign () -> Array;
	 */
	toArray: function toArray() {
		return this._items.slice();
	},

	/**
	 * @typesign () -> string;
	 */
	toString: function toString() {
		return this._items.join();
	}
});

['forEach', 'map', 'filter', 'every', 'some'].forEach(function(name) {
	ObservableList.prototype[name] = function(cb, context) {
		return this._items[name](function(item, index) {
			return cb.call(context, item, index, this);
		}, this);
	};
});

['reduce', 'reduceRight'].forEach(function(name) {
	ObservableList.prototype[name] = function(cb, initialValue) {
		var items = this._items;
		var list = this;

		function wrapper(accumulator, item, index) {
			return cb(accumulator, item, index, list);
		}

		return arguments.length >= 2 ? items[name](wrapper, initialValue) : items[name](wrapper);
	};
});

[
	['keys', function keys(index) {
		return index;
	}],
	['values', function values(index, item) {
		return item;
	}],
	['entries', function entries(index, item) {
		return [index, item];
	}]
].forEach(function(settings) {
	var getStepValue = settings[1];

	ObservableList.prototype[settings[0]] = function() {
		var items = this._items;
		var index = 0;
		var done = false;

		return {
			next: function() {
				if (!done) {
					if (index < items.length) {
						return {
							value: getStepValue(index, items[index++]),
							done: false
						};
					}

					done = true;
				}

				return {
					value: void 0,
					done: true
				};
			}
		};
	};
});

ObservableList.prototype[Symbol.iterator] = ObservableList.prototype.values;

export default ObservableList;
