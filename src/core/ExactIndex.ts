function ExactIndex(exactField) {
    this.index = Object.create(null);
    this.field = exactField;
  }

  // add the value you want returned to the key in the index
  ExactIndex.prototype = {
    set: function add(key, val) {
      if (this.index[key]) {
        this.index[key].push(val);
      } else {
        this.index[key] = [val];
      }
    },

    // remove the value from the index, if the value was the last one, remove the key
    remove: function remove(key, val) {
      var idxSet = this.index[key];
      for (var i in idxSet) {
        if (idxSet[i] == val) {
          idxSet.splice(i, 1);
        }
      }
      if (idxSet.length < 1) {
        this.index[key] = undefined;
      }
    },

    // get the values related to the key, could be more than one
    get: function get(key) {
      return this.index[key];
    },

    // clear will zap the index
    clear: function clear(key) {
      this.index = {};
    }
  };
