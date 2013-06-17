'use strict';
var requirejs = require("requirejs");
requirejs.config({
    baseUrl: __dirname + '/../../../build/standalone/lib',
    nodeRequire: require
});
var undo = requirejs("wed/undo");
var oop = requirejs("wed/oop");
var UndoList = undo.UndoList;
var Undo = undo.Undo;
var UndoGroup = undo.UndoGroup;
var chai = require("chai");
var assert = chai.assert;

function MyUndo(name, object) {
    Undo.call(this, "sets the field '" + this.name + "' from false to true'");
    this.object = object;
    this.name = name;

    object[name] = true;
}

oop.inherit(MyUndo, Undo);

(function () {
    this.undo = function () {
        this.object[this.name] = false;
    };

    this.redo = function () {
        this.object[this.name] = true;
    };
}).call(MyUndo.prototype);

function MyGroup(name) {
    UndoGroup.call(this, name);
}
oop.inherit(MyGroup, UndoGroup);

describe("UndoList", function () {

    var obj;
    var ul;

    beforeEach(function () {
        obj = {undo1: false, undo2: false};
        ul = new UndoList();
    });

    describe("canUndo", function () {
        it("returns false on new object", function () {
            assert.isFalse(ul.canUndo());
        });

        it("returns true when there is something to undo", function () {
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            assert.isTrue(ul.canUndo());
        });

        it("returns false when all is undone", function () {
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);

            ul.undo();
            ul.undo();
            assert.isFalse(ul.canUndo());
        });

    });

    describe("canRedo", function () {
        it("returns false on new object", function () {
            assert.isFalse(ul.canRedo());
        });

        it("returns true when there is something to redo", function () {
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            ul.undo();
            assert.isTrue(ul.canRedo());
        });

        it("returns false when all is redone", function () {
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);

            ul.undo();
            ul.undo();
            ul.redo();
            ul.redo();
            assert.isFalse(ul.canRedo());
        });
    });

    describe("endGroup", function () {
        it("throws an error when the object is new", function () {
            assert.Throw(ul.endGroup.bind(ul),
                         Error, "ending a non-existent group");
        });
        it("throws an error upon extra calls", function () {
            ul.startGroup(new MyGroup("group1"));
            ul.endGroup();
            assert.Throw(ul.endGroup.bind(ul),
                         Error, "ending a non-existent group");
        });
        it("ends groups in the proper order", function () {
            ul.startGroup(new MyGroup("group1"));
            ul.startGroup(new MyGroup("group2"));
            ul.endGroup();
            ul.endGroup();
            assert.equal(ul._list[0].toString(), "group1");
            assert.equal(ul._list.length, 1);
        });

    });

    describe("record", function () {
        it("records undo operations", function () {
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);

            // Peek in to make sure things are recorded.
            assert.equal(ul._list.length, 2);
            assert.strictEqual(ul._list[0], undo1);
            assert.strictEqual(ul._list[1], undo2);
        });

        it("overwrites old history", function () {
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);

            var undo3 = new MyUndo("undo3", obj);
            ul.record(undo3);
            var undo4 = new MyUndo("undo4", obj);
            ul.record(undo4);

            assert.isTrue(obj.undo3);
            assert.isTrue(obj.undo4);
            ul.undo();
            ul.undo();

            var undo5 = new MyUndo("undo5", obj);
            ul.record(undo5);
            var undo6 = new MyUndo("undo6", obj);
            ul.record(undo6);
            assert.equal(ul._list.length, 4);
            assert.strictEqual(ul._list[0], undo1);
            assert.strictEqual(ul._list[1], undo2);
            assert.strictEqual(ul._list[2], undo5);
            assert.strictEqual(ul._list[3], undo6);
        });

        it("records into the group when a group is in effect", function () {
            var group1 = new MyGroup("group1");
            ul.startGroup(group1);
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);
            ul.endGroup();

            var undo3 = new MyUndo("undo3", obj);
            ul.record(undo3);
            var undo4 = new MyUndo("undo4", obj);
            ul.record(undo4);

            assert.equal(ul._list.length, 3);
            assert.strictEqual(ul._list[0], group1);
            assert.strictEqual(ul._list[1], undo3);
            assert.strictEqual(ul._list[2], undo4);
            assert.equal(group1._list.length, 2);
        });


    });

    describe("undo", function () {
        it("actually undoes operations", function () {
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);

            assert.isTrue(obj.undo1);
            assert.isTrue(obj.undo2);
            ul.undo();
            assert.isTrue(obj.undo1);
            assert.isFalse(obj.undo2);
            ul.undo();
            assert.isFalse(obj.undo1);
            assert.isFalse(obj.undo2);
        });

        it("is a noop if there is nothing to undo", function () {
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);

            ul.undo();
            ul.undo();
            assert.equal(ul._list.length, 2);
            assert.equal(ul._index, -1);
            // Extra undo
            ul.undo();
            assert.equal(ul._list.length, 2);
            assert.equal(ul._index, -1);
        });

        it("undoes groups as a unit", function () {
            var group1 = new MyGroup("group1");
            ul.startGroup(group1);
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);
            ul.endGroup();

            assert.isTrue(obj.undo1);
            assert.isTrue(obj.undo2);
            ul.undo();
            assert.isFalse(obj.undo1);
            assert.isFalse(obj.undo2);
        });
    });

    describe("redo", function () {
        it("actually redoes operations", function () {
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);

            ul.undo();
            ul.undo();
            assert.isFalse(obj.undo1);
            assert.isFalse(obj.undo2);
            ul.redo();
            assert.isTrue(obj.undo1);
            assert.isFalse(obj.undo2);
            ul.redo();
            assert.isTrue(obj.undo1);
            assert.isTrue(obj.undo2);
        });

        it("is a noop if there is nothing to redo", function () {
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);

            ul.undo();
            ul.undo();
            ul.redo();
            ul.redo();
            assert.equal(ul._list.length, 2);
            assert.equal(ul._index, 1);
            // Extra redo
            ul.redo();
            // No change
            assert.equal(ul._list.length, 2);
            assert.equal(ul._index, 1);
        });

        it("redoes groups as a unit", function () {
            var group1 = new MyGroup("group1");
            ul.startGroup(group1);
            var undo1 = new MyUndo("undo1", obj);
            ul.record(undo1);
            var undo2 = new MyUndo("undo2", obj);
            ul.record(undo2);
            ul.endGroup();

            assert.isTrue(obj.undo1);
            assert.isTrue(obj.undo2);
            ul.undo();
            assert.isFalse(obj.undo1);
            assert.isFalse(obj.undo2);
            ul.redo();
            assert.isTrue(obj.undo1);
            assert.isTrue(obj.undo2);
        });

    });
});
