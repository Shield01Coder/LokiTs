/**
     * A loki persistence adapter which persists to web browser's local storage object
     * @constructor LokiLocalStorageAdapter
     */
 function LokiLocalStorageAdapter() { }
 function localStorageAvailable() {
    try {
      return (window && window.localStorage !== undefined && window.localStorage !== null);
    } catch (e) {
      return false;
    }
  }

 /**
  * loadDatabase() - Load data from localstorage
  * @param {string} dbname - the name of the database to load
  * @param {function} callback - the callback to handle the result
  * @memberof LokiLocalStorageAdapter
  */
 LokiLocalStorageAdapter.prototype.loadDatabase = function loadDatabase(dbname, callback) {
   if (localStorageAvailable()) {
     callback(localStorage.getItem(dbname));
   } else {
     callback(new Error('localStorage is not available'));
   }
 };

 /**
  * saveDatabase() - save data to localstorage, will throw an error if the file can't be saved
  * might want to expand this to avoid dataloss on partial save
  * @param {string} dbname - the filename of the database to load
  * @param {function} callback - the callback to handle the result
  * @memberof LokiLocalStorageAdapter
  */
 LokiLocalStorageAdapter.prototype.saveDatabase = function saveDatabase(dbname, dbstring, callback) {
   if (localStorageAvailable()) {
     localStorage.setItem(dbname, dbstring);
     callback(null);
   } else {
     callback(new Error('localStorage is not available'));
   }
 };

 /**
  * deleteDatabase() - delete the database from localstorage, will throw an error if it
  * can't be deleted
  * @param {string} dbname - the filename of the database to delete
  * @param {function} callback - the callback to handle the result
  * @memberof LokiLocalStorageAdapter
  */
 LokiLocalStorageAdapter.prototype.deleteDatabase = function deleteDatabase(dbname, callback) {
   if (localStorageAvailable()) {
     localStorage.removeItem(dbname);
     callback(null);
   } else {
     callback(new Error('localStorage is not available'));
   }
 };

