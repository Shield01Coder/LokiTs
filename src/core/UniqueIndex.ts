

export function UniqueIndex(uniqueField) {
  this.field = uniqueField;
  this.keyMap = Object.create(null);
  this.lokiMap = Object.create(null);
}
UniqueIndex.prototype.keyMap = {};
UniqueIndex.prototype.lokiMap = {};
UniqueIndex.prototype.set = function (obj) {
  var fieldValue = obj[this.field];
  if (fieldValue !== null && typeof (fieldValue) !== 'undefined') {
    if (this.keyMap[fieldValue]) {
      throw new Error('Duplicate key for property ' + this.field + ': ' + fieldValue);
    } else {
      this.keyMap[fieldValue] = obj;
      this.lokiMap[obj.$loki] = fieldValue;
    }
  }
};
UniqueIndex.prototype.get = function (key) {
  return this.keyMap[key];
};

UniqueIndex.prototype.byId = function (id) {
  return this.keyMap[this.lokiMap[id]];
};
/**
 * Updates a document's unique index given an updated object.
 * @param  {Object} obj Original document object
 * @param  {Object} doc New document object (likely the same as obj)
 */
UniqueIndex.prototype.update = function (obj, doc) {
  if (this.lokiMap[obj.$loki] !== doc[this.field]) {
    var old = this.lokiMap[obj.$loki];
    this.set(doc);
    // make the old key fail bool test, while avoiding the use of delete (mem-leak prone)
    this.keyMap[old] = undefined;
  } else {
    this.keyMap[obj[this.field]] = doc;
  }
};
UniqueIndex.prototype.remove = function (key) {
  var obj = this.keyMap[key];
  if (obj !== null && typeof obj !== 'undefined') {
    // avoid using `delete`
    this.keyMap[key] = undefined;
    this.lokiMap[obj.$loki] = undefined;
  } else {
    throw new Error('Key is not in unique index: ' + this.field);
  }
};
UniqueIndex.prototype.clear = function () {
  this.keyMap = Object.create(null);
  this.lokiMap = Object.create(null);
};

