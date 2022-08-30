"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenListField = exports.validateNonNullableFieldsTraverse = exports.getShouldAssert = exports.validateNonNullListField = exports.validateNonNullableFieldsAssert = exports.validateNonNullableFields = exports.validateUpdateArgs = exports.ShouldAssert = void 0;
var graphql_1 = require("graphql");
var common_1 = require("./common");
var graphQLUpdateType_1 = require("./graphQLUpdateType");
var ShouldAssert;
(function (ShouldAssert) {
    ShouldAssert[ShouldAssert["DefaultTrueRoot"] = 0] = "DefaultTrueRoot";
    ShouldAssert[ShouldAssert["True"] = 1] = "True";
    ShouldAssert[ShouldAssert["False"] = 2] = "False";
})(ShouldAssert = exports.ShouldAssert || (exports.ShouldAssert = {}));
var defaultOptions = {
    overwrite: false,
};
function validateUpdateArgs(updateArgs, graphQLType, options) {
    if (options === void 0) { options = defaultOptions; }
    var errors = [];
    errors = errors.concat(validateNonNullableFieldsOuter(updateArgs, graphQLType, options));
    if (errors.length > 0) {
        throw new graphql_1.GraphQLError(errors.join("\n"));
    }
}
exports.validateUpdateArgs = validateUpdateArgs;
function validateNonNullableFieldsOuter(updateArgs, graphQLType, _a) {
    var overwrite = _a.overwrite, isResolvedField = _a.isResolvedField;
    var shouldAssert = !!updateArgs.setOnInsert
        ? ShouldAssert.True
        : overwrite
            ? ShouldAssert.DefaultTrueRoot
            : ShouldAssert.False;
    return validateNonNullableFields(Object.keys(updateArgs).map(function (_) { return updateArgs[_]; }), graphQLType, shouldAssert, isResolvedField);
}
function validateNonNullableFields(objects, graphQLType, shouldAssert, isResolvedField, path) {
    if (isResolvedField === void 0) { isResolvedField = function (field) { return !!field.resolve; }; }
    if (path === void 0) { path = []; }
    var typeFields = graphQLType.getFields();
    var errors = shouldAssert === ShouldAssert.True ? validateNonNullableFieldsAssert(objects, typeFields, path) : [];
    var overwrite = objects.map(function (_) { return _[graphQLUpdateType_1.OVERWRITE]; }).filter(function (_) { return _; })[0];
    shouldAssert = getShouldAssert(shouldAssert, overwrite);
    return __spreadArray(__spreadArray([], errors, true), validateNonNullableFieldsTraverse(objects, typeFields, shouldAssert, isResolvedField, path), true);
}
exports.validateNonNullableFields = validateNonNullableFields;
function validateNonNullableFieldsAssert(objects, typeFields, path) {
    if (path === void 0) { path = []; }
    return Object
        .keys(typeFields)
        .map(function (key) { return ({ key: key, type: typeFields[key].type }); })
        .filter(function (field) { return (0, common_1.isNonNullField)(field.type) && (field.key !== '_id' || path.length > 0); })
        .reduce(function (agg, field) {
        var fieldPath = __spreadArray(__spreadArray([], path, true), [field.key], false).join(".");
        var fieldValues = objects.map(function (_) { return _[field.key]; }).filter(function (_) { return _ !== undefined; });
        if (field.type instanceof graphql_1.GraphQLNonNull) {
            if (fieldValues.some(function (_) { return _ === null; }))
                return __spreadArray(__spreadArray([], agg, true), ["Non-nullable field \"".concat(fieldPath, "\" is set to null")], false);
            if (fieldValues.length === 0)
                return __spreadArray(__spreadArray([], agg, true), ["Missing non-nullable field \"".concat(fieldPath, "\"")], false);
        }
        if ((0, common_1.isListField)(field.type) && !validateNonNullListField(fieldValues, field.type)) {
            return __spreadArray(__spreadArray([], agg, true), ["Non-nullable element of array \"".concat(fieldPath, "\" is set to null")], false);
        }
        return agg;
    }, []);
}
exports.validateNonNullableFieldsAssert = validateNonNullableFieldsAssert;
function validateNonNullListField(fieldValues, type) {
    if (type instanceof graphql_1.GraphQLNonNull) {
        if (fieldValues.some(function (_) { return _ === null; })) {
            return false;
        }
        return validateNonNullListField(fieldValues, type.ofType);
    }
    if (type instanceof graphql_1.GraphQLList) {
        return validateNonNullListField((0, common_1.flatten)(fieldValues.filter(function (_) { return _; })), type.ofType);
    }
    return true;
}
exports.validateNonNullListField = validateNonNullListField;
function getShouldAssert(current, input) {
    if (current === ShouldAssert.True) {
        return ShouldAssert.True;
    }
    if (typeof input !== "undefined") {
        return input ? ShouldAssert.True : ShouldAssert.False;
    }
    if (current === ShouldAssert.DefaultTrueRoot) {
        return ShouldAssert.True;
    }
    return current;
}
exports.getShouldAssert = getShouldAssert;
function validateNonNullableFieldsTraverse(objects, typeFields, shouldAssert, isResolvedField, path) {
    if (isResolvedField === void 0) { isResolvedField = function (field) { return !!field.resolve; }; }
    if (path === void 0) { path = []; }
    var keys = Array.from(new Set((0, common_1.flatten)(objects.map(function (_) { return Object.keys(_); }))));
    return keys.reduce(function (agg, key) {
        var field = typeFields[key];
        var type = field.type;
        var innerType = (0, common_1.getInnerType)(type);
        if (!(innerType instanceof graphql_1.GraphQLObjectType) || isResolvedField(field)) {
            return agg;
        }
        var newPath = __spreadArray(__spreadArray([], path, true), [key], false);
        var values = objects.map(function (_) { return _[key]; }).filter(function (_) { return _; });
        if ((0, common_1.isListField)(type)) {
            return __spreadArray(__spreadArray([], agg, true), (0, common_1.flatten)(flattenListField(values, type).map(function (_) { return validateNonNullableFields([_], innerType, ShouldAssert.True, isResolvedField, newPath); })), true);
        }
        else {
            return __spreadArray(__spreadArray([], agg, true), validateNonNullableFields(values, innerType, shouldAssert, isResolvedField, newPath), true);
        }
    }, []);
}
exports.validateNonNullableFieldsTraverse = validateNonNullableFieldsTraverse;
function flattenListField(objects, type) {
    if (type instanceof graphql_1.GraphQLNonNull) {
        return flattenListField(objects, type.ofType);
    }
    if (type instanceof graphql_1.GraphQLList) {
        return flattenListField((0, common_1.flatten)(objects).filter(function (_) { return _; }), type.ofType);
    }
    return objects;
}
exports.flattenListField = flattenListField;
