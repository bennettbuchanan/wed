/**
 * @module saver
 * @desc Data saving functionality.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:saver */function (require, exports, module) {
'use strict';

var oop = require("./oop");
var SimpleEventEmitter =
        require("./lib/simple_event_emitter").SimpleEventEmitter;
var Conditioned = require("./lib/conditioned").Conditioned;
var browsers = require("./browsers");
var serializer = require("./serializer");

var AUTO = 1;
var MANUAL = 2;

/**
 * @classdesc A saver is responsible for saving a document's
 * data. This class cannot be instantiated as-is, but only through
 * subclasses.
 *
 * @mixes module:lib/simple_event_emitter~SimpleEventEmitter
 * @mixes module:lib/conditioned~Conditioned
 *
 * @emits module:saver~Saver#changed
 *
 * @constructor
 * @param {string} version The version of wed for which this object is
 * created.
 * @param {module:tree_updater~TreeUpdater} data_updater The updater
 * that the editor created for its data tree.
 * @param {Node} data_tree The editor's data tree.
 *
 */
function Saver(version, data_updater, data_tree) {
    // Call our mixin's constructors.
    SimpleEventEmitter.call(this);
    Conditioned.call(this);

    /**
     * The wed version for which this saver was created. This may be
     * used to store version information together with the document
     * being saved.
     * @protected
     * @readonly
     */
    this._version = version;

    /**
     * The data updater with which the document to save is being updated.
     * @private
     * @readonly
     */
    this._data_updater = data_updater;

    /**
     * The data tree of the document being updated.
     * @protected
     * @readonly
     */
    this._data_tree = data_tree;

    /**
     * Subclasses must set this variable to true once they have
     * finished with their initialization.
     * @protected
     */
    this._initialized = false;

    /**
     * Subclasses must set this variable to true if the saver is in a
     * failed state.
     * @protected
     */
    this._failed = undefined;

    /**
     * The generation that is currently being edited.  It is
     * mutable. Derived classes can read it but not modify it.
     * @protected
     */
    this._current_generation = 0;

    /**
     * The generation that has last been saved. Derived classes can
     * read it but not modify it. It is mutable.
     * @protected
     */
    this._saved_generation = 0;

    /**
     * The date of last modification.
     * @private
     */
    this._last_modification = undefined;

    /**
     * The date of last save.
     * @private
     */
    this._last_save = undefined;

    /**
     * The last kind of save.
     * @private
     */
    this._last_save_kind = undefined;

    /**
     * The interval at which to autosave, in milliseconds.
     * @private
     */
    this._autosave_interval = undefined;

    /**
     * The current timeout object which will trigger an autosave. It
     * has the value ``undefined`` if there is no current timeout.
     * @private
     */
    this._autosave_timeout = undefined;

    data_updater.addEventListener("changed", function () {
        this._last_modification = Date.now();
        if (this._saved_generation === this._current_generation) {
            this._current_generation++;
            /**
             * This event is emitted when the saver detects that the
             * document it is responsible for saving has changed in a
             * way that makes it stale from the point of view of
             * saving.
             *
             * Suppose that the document has been saved. Then a change
             * is made. Upon this first change, this event is
             * emitted. Then a change is made again. Since the
             * document was *already* stale, this event is not emitted
             * again.
             *
             * @event module:saver~Saver#changed
             */
            this._emit("changed");
        }
    }.bind(this));

    /**
     * The _autosave method, pre-bound to ``this``.
     * @private
     */
    this._bound_autosave = this._autosave.bind(this);
}

oop.implement(Saver, SimpleEventEmitter);
oop.implement(Saver, Conditioned);

/**
 * This method must be called when the user manually initiates a save.
 * @throws {Error} If there are any problems communicating with the server
 * when saving.
 * @param {Function} [done] A function to call once the save operation
 * has been completed. The function's first parameter is the error
 * encountered. It will be ``null`` if there is no error.
 * @emits module:saver~Saver#failed
 * @emits module:saver~Saver#saved
 * @emits module:saver~Saver#autosaved
 */
Saver.prototype.save = function (done) {
    this._save(false, done);
};

/**
 * This method is called when saving or autosaving. This is the method
 * responsible for the implementation-specific details.
 *
 * @protected
 * @abstract
 *
 * @param {boolean} autosave ``true`` if called by an autosave,
 * ``false`` if not.
 * @param {Function} [done] A function to call once the save operation
 * has been completed. The function's first parameter is the error
 * encountered. It will be ``null`` if there is no error.
 * @emits module:saver~Saver#failed
 * @emits module:saver~Saver#saved
 * @emits module:saver~Saver#autosaved
 */
Saver.prototype._save = function(autosave, done) {
    throw new Error("derived classes must implement this method");
};

/**
 * This method returns the data to be saved in a save
 * operation. Derived classes **must** call this method rather than
 * get the data directly from the data tree.
 */
Saver.prototype.getData = function () {
    if (browsers.MSIE) {
        return serializer.serialize(this._data_tree.firstChild);
    }


    return this._data_tree.innerHTML;
};

/**
 * Must be called by derived class upon a successful save.
 *
 * @protected
 *
 * @param {boolean} autosave ``true`` if called for an autosave
 * operation, ``false`` if not.
 * @param saving_generation The generation being saved. It is
 * necessary to pass this value due to the asynchronous nature of some
 * saving operations.
 *
 * @emits module:saver~Saver#saved
 * @emits module:saver~Saver#autosaved
 *
 */
Saver.prototype._saveSuccess = function (autosave, saving_generation) {
    // If we get here, we've been successful.
    this._saved_generation = saving_generation;
    this._last_save = Date.now();
    this._last_save_kind = autosave ? AUTO : MANUAL;
    /**
     * This event is emitted after a document has been successfully saved.
     *
     * @event module:saver~Saver#saved
     */
    /**
     * This event is emitted after a document has been successfully autosaved.
     *
     * @event module:saver~Saver#autosaved
     */
    this._emit(autosave ? "autosaved" : "saved");
    // This resets the countdown to now.
    this.setAutosaveInterval(this._autosave_interval);
};

/**
 * Must be called by derived classes when they fail to perform their task.
 *
 * @protected
 *
 * @param {Object} [error] The error message associated with the
 * failure. If the error message is specified a ``failed`` event will
 * be emitted. If not, no event is emitted.
 *
 * @emits module:saver~Saver#failed
 */
Saver.prototype._fail = function (error) {
    this._failed = true;
    if (error)
        /**
         * Emitted upon a failure during operations. The possible
         * values for ``type`` are:
         *
         * - ``save_edited`` when the file to be saved has changed in
         *   the save media. (For instance, if someone else edited a
         *   file that is stored on a server.)
         *
         * - ``save_disconnected`` when the saver has lost contact
         *   with the media that holds the data to be saved.
         *
         * - ``save_transient_error`` when an recoverable error
         *   happened while saving. These are errors that a user
         *   should be able to recover from. For instance, if the
         *   document must contain a specific piece of information
         *   before being saved, this kind of error may be used to
         *   notify the user.
         *
         * @event module:saver~Saver#failed
         * @type {object}
         * @property {string} type The type of the error.
         * @property {string} msg A human readable error message.
         */
        this._emit("failed", error);
};

/**
 * This is the function called internally when an autosave is needed.
 *
 * @private
 * @emits module:saver~Saver#autosaved
 */
Saver.prototype._autosave = function () {
    this._autosave_timeout = undefined;
    var me = this;
    function done() {
        // Calling ``setAutosaveInterval`` effectively starts a new
        // timeout, and takes care of possible race conditions. For
        // instance, a call to ``setAutosaveInterval`` could happen
        // after the current timeout has started saving but before
        // ``done`` is called. This would launch a new timeout. If the
        // code here called ``setTimeout`` instead of
        // ``setAutosaveInterval`` then two timeouts would be running.
        me.setAutosaveInterval(me._autosave_interval);
    }

    if (this._current_generation !== this._saved_generation)
        // We have something to save!
        this._save(true, done);
    else
        done();
};

/**
 * Changes the interval at which autosaves are performed. Note that
 * calling this function will stop the current countdown and restart
 * it from zero. If, for instance, the previous interval was 5
 * minutes, and 4 minutes had elapsed since the last save, the next
 * autosave should happen one minute from now. However, if I now call
 * this function with a new interval of 4 minutes, this will cause the
 * next autosave to happen 4 minutes after the call, rather than one
 * minute.
 *
 * @param {number} interval The interval between autosaves in
 * milliseconds. 0 turns off autosaves.
 */
Saver.prototype.setAutosaveInterval = function (interval) {
    this._autosave_interval = interval;
    var old_timeout = this._autosave_timeout;

    if (old_timeout)
        clearTimeout(old_timeout);

    this._autosave_timeout = interval ?
        setTimeout(this._bound_autosave, interval): undefined;
};

/**
 * This method is to be used by wed upon encountering a fatal
 * error. It will attempt to record the last state of the data tree
 * before wed dies.
 *
 * @param {Function} done A function to call once the recovery
 * operation is done. Cannot be ``null`` or ``undefined``. This
 * function must accept one parameter which will be set to
 * ``undefined`` if the method did not do anything because the Saver
 * object is in an unintialized state or has already failed. It will
 * be set to ``true`` if the recovery operation was successful, and
 * ``false`` if not.
 */
Saver.prototype.recover = function (done) {
    if (!this._initialized || this._failed) {
        done(undefined);
        return;
    }

    this._recover(done);
};

/**
 * This method is called when recovering. This is the method
 * responsible for the implementation-specific details.
 *
 * @protected
 * @abstract
 *
 * @param {Function} done A function to call once the recovery
 * operation is done. Cannot be ``null`` or ``undefined``.  It will be
 * set to ``true`` if the recovery operation was successful, and
 * ``false`` if not.
 */
Saver.prototype._recover = function (done) {
    throw new Error("derived classes must implement this method");
};

function deltaToString(delta) {
    delta = Math.round(delta / 1000);
    var time_desc = "moments ago";
    if (delta > 0) {
        time_desc = " ≈ ";
        // To get a single digit after the decimal point, we divide by
        // (factor / 10), round the result, and then divide by
        // 10. Note that this is imprecise due to rounding errors in
        // floating point arithmetics but we don't care.
        if (delta > 60 * 60 * 24) {
            time_desc += (Math.round(delta / (6 * 60 * 24)) / 10) + "d";
        }
        else if (delta > 60 * 60) {
            time_desc += (Math.round(delta / (6 * 60)) / 10) + "h";
        }
        else if (delta > 60) {
            time_desc += (Math.round(delta / 6) / 10) + "m";
        }
        else {
            time_desc += delta + "s";
        }
        time_desc += " ago";
    }
    return time_desc;
}

/**
 * Returns information regarding whether the saver sees the data tree
 * as having been modified since the last save occurred.
 *
 * @returns {string|false} Returns ``false`` if the tree has not been
 * modified. Otherwise, returns a string that describes how long ago
 * the modification happened.
 */
Saver.prototype.getModifiedWhen = function () {
    if (this._saved_generation === this._current_generation)
        return false;

    return deltaToString(Date.now() - this._last_modification);
};


/**
 * Produces a string that indicates in human readable format when the
 * last save occurred.
 *
 * @returns {string|undefined} The string. The value ``undefined`` is
 * returned if no save has occurred yet.
 */
Saver.prototype.getSavedWhen = function () {
    if (this._last_save_kind === undefined)
        return undefined;

    return deltaToString(Date.now() - this._last_save);
};


/**
 * Returns the last kind of save that occurred.
 *
 * @returns {number|undefined} The kind. The value will be
 * ``undefined`` if there has not been any save yet.
 */
Saver.prototype.getLastSaveKind = function () {
    return this._last_save_kind;
};

exports.Saver = Saver;
exports.AUTO = AUTO;
exports.MANUAL = MANUAL;

});

//  LocalWords:  jQuery jquery url jshint validthis Dubeau MPL oop
//  LocalWords:  Mangalam mixin's json unintialized param dataType
//  LocalWords:  SimpleEventEmitter
