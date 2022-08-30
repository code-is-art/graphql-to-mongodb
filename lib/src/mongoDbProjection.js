"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.getMongoDbProjection = void 0;
var common_1 = require("./common");
var graphql_1 = require("graphql");
var logger_1 = require("./logger");
;
var defaultOptions = {
    isResolvedField: (function (field) { return !!field.resolve; }),
    excludedFields: [],
};
exports.getMongoDbProjection = (0, logger_1.logOnError)(function (info, graphQLFieldsType, options) {
    if (options === void 0) { options = defaultOptions; }
    if (!Object.keys(info).includes('fieldNodes'))
        throw 'First argument of "getMongoDbProjection" must be a GraphQLResolveInfo';
    if (!(0, graphql_1.isType)(graphQLFieldsType))
        throw 'Second argument of "getMongoDbProjection" must be a GraphQLType';
    var nodes = (0, common_1.flatten)(info.fieldNodes.map(function (_) { return __spreadArray([], _.selectionSet.selections, true); }));
    var projection = getSelectedProjection(nodes, graphQLFieldsType, { info: info, fragments: {} }, __assign(__assign({}, options), { isResolvedField: options.isResolvedField || (function (field) { return !!field.resolve; }) }));
    return omitRedundantProjection(projection);
});
function getSelectedProjection(selectionNodes, graphQLFieldsType, extra, options) {
    if (options === void 0) { options = defaultOptions; }
    var fields = graphQLFieldsType.getFields();
    return selectionNodes.reduce(function (projection, node) {
        var _a;
        if (node.kind === 'Field') {
            if (node.name.value === '__typename' || options.excludedFields.includes(node.name.value))
                return projection;
            var field = fields[node.name.value];
            if (options.isResolvedField(field)) {
                var dependencies = [];
                var extensions = field.extensions;
                if (extensions.graphqlToMongoDb && extensions.graphqlToMongoDb.dependencies) {
                    dependencies = extensions.graphqlToMongoDb.dependencies;
                }
                var dependenciesProjection = dependencies.reduce(function (agg, dependency) {
                    var _a;
                    return (__assign(__assign({}, agg), (_a = {}, _a[dependency] = 1, _a)));
                }, {});
                return __assign(__assign({}, projection), dependenciesProjection);
            }
            if (!node.selectionSet)
                return __assign(__assign({}, projection), (_a = {}, _a[node.name.value] = 1, _a));
            var nested = getSelectedProjection(__spreadArray([], node.selectionSet.selections, true), (0, common_1.getInnerType)(field.type), extra, options);
            return __assign(__assign({}, projection), (0, common_1.addPrefixToProperties)(nested, "".concat(node.name.value, ".")));
        }
        else if (node.kind === 'InlineFragment') {
            var type = extra.info.schema.getType(node.typeCondition.name.value);
            return __assign(__assign({}, projection), getSelectedProjection(__spreadArray([], node.selectionSet.selections, true), type, extra, options));
        }
        else if (node.kind === 'FragmentSpread') {
            return __assign(__assign({}, projection), getFragmentProjection(node, graphQLFieldsType, extra, options));
        }
    }, {});
}
function getFragmentProjection(fragmentSpreadNode, graphQLFieldsType, extra, options) {
    if (options === void 0) { options = defaultOptions; }
    var fragmentName = fragmentSpreadNode.name.value;
    if (extra.fragments[fragmentName])
        return extra.fragments[fragmentName];
    var fragmentNode = extra.info.fragments[fragmentName];
    extra.fragments[fragmentName] = getSelectedProjection(__spreadArray([], fragmentNode.selectionSet.selections, true), graphQLFieldsType, extra, options);
    return extra.fragments[fragmentName];
}
function omitRedundantProjection(projection) {
    return Object.keys(projection).reduce(function (proj, key) {
        var _a;
        if (Object.keys(projection).some(function (otherKey) {
            return otherKey !== key && new RegExp("^".concat(otherKey, "[.]")).test(key);
        })) {
            return proj;
        }
        return __assign(__assign({}, proj), (_a = {}, _a[key] = 1, _a));
    }, {});
}
