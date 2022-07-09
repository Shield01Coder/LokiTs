
      /**
       * LokiEventEmitter is a minimalist version of EventEmitter. It enables any
       * constructor that inherits EventEmitter to emit events and trigger
       * listeners that have been added to the event through the on(event, callback) method
       *
       * @constructor LokiEventEmitter
       */
       function LokiEventEmitter() { }
  
       /**
        * @prop {hashmap} events - a hashmap, with each property being an array of callbacks
        * @memberof LokiEventEmitter
        */
       LokiEventEmitter.prototype.events = {};
   
       /**
        * @prop {boolean} asyncListeners - boolean determines whether or not the callbacks associated with each event
        * should happen in an async fashion or not
        * Default is false, which means events are synchronous
        * @memberof LokiEventEmitter
        */
       LokiEventEmitter.prototype.asyncListeners = false;
   
       /**
        * on(eventName, listener) - adds a listener to the queue of callbacks associated to an event
        * @param {string|string[]} eventName - the name(s) of the event(s) to listen to
        * @param {function} listener - callback function of listener to attach
        * @returns {int} the index of the callback in the array of listeners for a particular event
        * @memberof LokiEventEmitter
        */
       LokiEventEmitter.prototype.on = function (eventName, listener) {
         var event;
         var self = this;
   
         if (Array.isArray(eventName)) {
           eventName.forEach(function (currentEventName) {
             self.on(currentEventName, listener);
           });
           return listener;
         }
   
         event = this.events[eventName];
         if (!event) {
           event = this.events[eventName] = [];
         }
         event.push(listener);
         return listener;
       };
   
       /**
        * emit(eventName, data) - emits a particular event
        * with the option of passing optional parameters which are going to be processed by the callback
        * provided signatures match (i.e. if passing emit(event, arg0, arg1) the listener should take two parameters)
        * @param {string} eventName - the name of the event
        * @param {object=} data - optional object passed with the event
        * @memberof LokiEventEmitter
        */
       LokiEventEmitter.prototype.emit = function (eventName) {
         var self = this;
         var selfArgs;
         if (eventName && this.events[eventName]) {
           if (this.events[eventName].length) {
             selfArgs = Array.prototype.slice.call(arguments, 1);
             this.events[eventName].forEach(function (listener) {
               if (self.asyncListeners) {
                 setTimeout(function () {
                   listener.apply(self, selfArgs);
                 }, 1);
               } else {
                 listener.apply(self, selfArgs);
               }
             });
           }
         } else {
           throw new Error('No event ' + eventName + ' defined');
         }
       };
   
       /**
        * Alias of LokiEventEmitter.prototype.on
        * addListener(eventName, listener) - adds a listener to the queue of callbacks associated to an event
        * @param {string|string[]} eventName - the name(s) of the event(s) to listen to
        * @param {function} listener - callback function of listener to attach
        * @returns {int} the index of the callback in the array of listeners for a particular event
        * @memberof LokiEventEmitter
        */
       LokiEventEmitter.prototype.addListener = LokiEventEmitter.prototype.on;
   
       /**
        * removeListener() - removes the listener at position 'index' from the event 'eventName'
        * @param {string|string[]} eventName - the name(s) of the event(s) which the listener is attached to
        * @param {function} listener - the listener callback function to remove from emitter
        * @memberof LokiEventEmitter
        */
       LokiEventEmitter.prototype.removeListener = function (eventName, listener) {
         var self = this;
   
         if (Array.isArray(eventName)) {
           eventName.forEach(function (currentEventName) {
             self.removeListener(currentEventName, listener);
           });
   
           return;
         }
   
         if (this.events[eventName]) {
           var listeners = this.events[eventName];
           listeners.splice(listeners.indexOf(listener), 1);
         }
       };