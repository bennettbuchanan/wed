/**
 * @module undo_recorder
 * @desc Listens to changes on a tree record undo operations
 * corresponding to these changes.
 * @author Louis-Dominique Dubeau
 */

define(/** @lends module:undo_recorder */ function (require, exports, module) {
'use strict';

var domutil = require("./domutil");
var $ = require("jquery");
var oop = require("./oop");
var undo = require("./undo");

function UndoRecorder (editor, tree_updater) {
    this._editor = editor;
    this._tree_updater = tree_updater;
    this._tree_updater.addEventListener(
        "insertNodeAt", this._insertNodeAtHandler.bind(this));
    this._tree_updater.addEventListener(
        "setTextNodeValue", this._setTextNodeValueHandler.bind(this));
    this._tree_updater.addEventListener(
        "deleteNode", this._deleteNodeHandler.bind(this));
    this._suppress = false;
}

UndoRecorder.prototype.suppressRecording = function (suppress) {
    if (suppress === this._suppress)
        throw new Error("spurious call to suppressRecording");
    this._suppress = suppress;
};

UndoRecorder.prototype._insertNodeAtHandler = function (ev) {
    if (this._suppress)
        return;
    this._editor.recordUndo(new InsertNodeAtUndo(
        this._tree_updater,
        ev.parent,
        ev.index,
        ev.node));
};

UndoRecorder.prototype._setTextNodeValueHandler = function (ev) {
    if (this._suppress)
        return;
    this._editor.recordUndo(new SetTextNodeValueUndo(
        this._tree_updater, ev.node, ev.value, ev.old_value));
};

UndoRecorder.prototype._deleteNodeHandler = function (ev) {
    if (this._suppress)
        return;
    this._editor.recordUndo(new DeleteNodeUndo(this._tree_updater, ev.node));
};

function InsertNodeAtUndo(tree_updater, parent, index, node) {
    undo.Undo.call(this, "InsertNodeAtUndo");
    this._tree_updater = tree_updater;
    this._parent_path = tree_updater.nodeToPath(parent);
    this._index = index;
    this._node = undefined;
}

oop.inherit(InsertNodeAtUndo, undo.Undo);

InsertNodeAtUndo.prototype.undo = function () {
    if (this._node)
        throw new Error("undo called twice in a row");
    var parent = this._tree_updater.pathToNode(this._parent_path);
    this._node = $(parent.childNodes[this._index]).clone().get(0);
    this._tree_updater.deleteNode(parent.childNodes[this._index]);
};

InsertNodeAtUndo.prototype.redo = function () {
    if (!this._node)
        throw new Error("redo called twice in a row");
    var parent = this._tree_updater.pathToNode(this._parent_path);
    this._tree_updater.insertNodeAt(parent, this._index, this._node);
    this._node = undefined;
};

InsertNodeAtUndo.prototype.toString = function () {
    function dump (it) {
        return it ? ($(it).clone().wrap('<div>').parent().html() ||
                     $(it).text()) : "undefined";
    }
    return [this._desc, "\n",
            " Parent path: ",  this._parent_path, "\n",
            " Index: ", this._index, "\n",
            " Node: ", dump(this._node), "\n"].join("");
};

function SetTextNodeValueUndo(tree_updater, node, value, old_value) {
    undo.Undo.call(this, "SetTextNodeValueUndo");
    this._tree_updater = tree_updater;
    this._node_path = tree_updater.nodeToPath(node);
    this._new_value = value;
    this._old_value = old_value;
}

oop.inherit(SetTextNodeValueUndo, undo.Undo);

SetTextNodeValueUndo.prototype.undo = function () {
    var node = this._tree_updater.pathToNode(this._node_path);
    this._tree_updater.setTextNodeValue(node, this._old_value);
};

SetTextNodeValueUndo.prototype.redo = function () {
    var node = this._tree_updater.pathToNode(this._node_path);
    this._tree_updater.setTextNodeValue(node, this._new_value);
};

SetTextNodeValueUndo.prototype.toString = function () {
    return [this._desc, "\n",
            " Node path: ",  this._node_path, "\n",
            " New value: ", this._new_value, "\n",
            " Old value: ", this._old_value, "\n"].join("");
};

function DeleteNodeUndo(tree_updater, node) {
    undo.Undo.call(this, "DeleteNodeUndo");
    this._tree_updater = tree_updater;
    var parent = node.parentNode;
    this._parent_path = tree_updater.nodeToPath(parent);
    this._index = Array.prototype.indexOf.call(parent.childNodes,
                                               node);
    this._node = $(node).clone().get(0);
}

oop.inherit(DeleteNodeUndo, undo.Undo);

DeleteNodeUndo.prototype.undo = function () {
    if (!this._node)
        throw new Error("undo called twice in a row");
    var parent = this._tree_updater.pathToNode(this._parent_path);
    this._tree_updater.insertNodeAt(parent, this._index, this._node);
    this._node = undefined;
};

DeleteNodeUndo.prototype.redo = function () {
    if (this._node)
        throw new Error("redo called twice in a row");
    var parent = this._tree_updater.pathToNode(this._parent_path);
    this._node = $(parent.childNodes[this._index]).clone().get(0);
    this._tree_updater.deleteNode(parent.childNodes[this._index]);
};

DeleteNodeUndo.prototype.toString = function () {
    function dump (it) {
        return it ? ($(it).clone().wrap('<div>').parent().html() ||
                     $(it).text()) : "undefined";
    }
    return [this._desc, "\n",
            " Parent path: ",  this._parent_path, "\n",
            " Index: ", this._index, "\n",
            " Node: ", dump(this._node), "\n"].join("");
};



exports.UndoRecorder = UndoRecorder;

});

//  LocalWords:  domutil jquery oop insertNodeAt setTextNodeValue
//  LocalWords:  deleteNode InsertNodeAtUndo SetTextNodeValueUndo
//  LocalWords:  DeleteNodeUndo