class ImmutableCollection {
  constructor(value) {
    this._value = value;
  }

  get size() {
    return this._value.size;
  }

  toArray() {
    return Array.from(this._value.values(), toJS);
  }

  toJS() {
    return toJS(this);
  }

  toJSON() {
    return toJS(this);
  }

  [Symbol.iterator]() {
    return Array.from(this._value.values(), toJS)[Symbol.iterator]();
  }
}

class ImmutableMap extends ImmutableCollection {
  constructor(value) {
    const entries = value instanceof Map
      ? value.entries()
      : value && typeof value.entries === 'function'
        ? value.entries()
        : Object.entries(value || {});
    super(new Map(entries));
  }

  get(key, notSetValue) {
    return this._value.has(key) ? this._value.get(key) : notSetValue;
  }

  getIn(path, notSetValue) {
    let current = this;
    for (const key of path) {
      if (!current || typeof current.get !== 'function') return notSetValue;
      current = current.get(key);
      if (current === undefined) return notSetValue;
    }
    return current;
  }

  has(key) {
    return this._value.has(key);
  }

  set(key, value) {
    const next = new Map(this._value);
    next.set(key, fromJS(value));
    return new ImmutableMap(next);
  }

  remove(key) {
    const next = new Map(this._value);
    next.delete(key);
    return new ImmutableMap(next);
  }

  toObject() {
    return Object.fromEntries(Array.from(this._value.entries(), ([key, value]) => [key, toJS(value)]));
  }

  keys() {
    return this._value.keys();
  }

  values() {
    return Array.from(this._value.values(), toJS)[Symbol.iterator]();
  }

  entries() {
    return Array.from(this._value.entries(), ([key, value]) => [key, toJS(value)])[Symbol.iterator]();
  }
}

class ImmutableList extends ImmutableCollection {
  constructor(value) {
    super(new Map(Array.from(value || [], (item, index) => [index, item])));
  }

  get(index, notSetValue) {
    return this._value.has(index) ? this._value.get(index) : notSetValue;
  }

  push(value) {
    return new ImmutableList([...this.toArray(), value]);
  }

  concat(value) {
    return new ImmutableList([...this.toArray(), ...Array.from(value || [], toJS)]);
  }

  map(callback) {
    return new ImmutableList(this.toArray().map(callback));
  }

  filter(callback) {
    return new ImmutableList(this.toArray().filter(callback));
  }
}

function fromJS(value) {
  if (value instanceof ImmutableMap || value instanceof ImmutableList) return value;
  if (Array.isArray(value)) return new ImmutableList(value.map(fromJS));
  if (value && typeof value === 'object') {
    return new ImmutableMap(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fromJS(item)])));
  }
  return value;
}

function toJS(value) {
  if (value instanceof ImmutableMap) return value.toObject();
  if (value instanceof ImmutableList) return value.toArray();
  return value;
}

function MapFactory(value) {
  return value instanceof ImmutableMap ? value : new ImmutableMap(value);
}

function ListFactory(value) {
  return value instanceof ImmutableList ? value : new ImmutableList(value);
}

MapFactory.isMap = (value) => value instanceof ImmutableMap;
ListFactory.isList = (value) => value instanceof ImmutableList;

export const Map = MapFactory;
export const List = ListFactory;
export const OrderedMap = MapFactory;
export const OrderedSet = ListFactory;
export const Set = ListFactory;
export const Stack = ListFactory;
export { fromJS, toJS };
export const isMap = MapFactory.isMap;
export const isList = ListFactory.isList;
export const isCollection = (value) => value instanceof ImmutableCollection;
export const isKeyed = isMap;
export const isIndexed = isList;
export const isIterable = (value) => isCollection(value);
export const is = Object.is;
export default {
  Map,
  List,
  OrderedMap,
  OrderedSet,
  Set,
  Stack,
  fromJS,
  toJS,
  isMap,
  isList,
  isCollection,
  isKeyed,
  isIndexed,
  isIterable,
  is
};
