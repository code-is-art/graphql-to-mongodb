import { GraphQLInputObjectType, GraphQLList, GraphQLEnumType, GraphQLNonNull, GraphQLScalarType, GraphQLObjectType, GraphQLInputFieldConfigMap, GraphQLInputType, GraphQLString, isLeafType, GraphQLLeafType, GraphQLInterfaceType, GraphQLUnionType } from 'graphql';
import { cache, setSuffix, getUnresolvedFieldsTypes, getTypeFields, FieldMap, typesCache, GraphQLFieldsType } from './common';
import { warn } from './logger';

const warnedIndependentResolvers = {};

const GetOprExistsType = () => cache(typesCache, "OprExists", () => new GraphQLEnumType({
    name: 'OprExists',
    values: {
        EXISTS: { value: "exists" },
        NOT_EXISTS: { value: "not_exists" },
    }
}));

export function getGraphQLFilterType(type: GraphQLFieldsType, ...excludedFields: string[]): GraphQLInputObjectType {
    const filterTypeName = setSuffix(type.name, 'Type', 'FilterType');

    return cache(typesCache, filterTypeName, () => new GraphQLInputObjectType({
        name: filterTypeName,
        fields: getOrAndFields(type, ...excludedFields)
    }));
}

function getOrAndFields(type: GraphQLFieldsType, ...excludedFields: string[]): () => FieldMap<GraphQLInputType> {
    return () => {
        const generatedFields = getUnresolvedFieldsTypes(type, getGraphQLObjectFilterType, ...excludedFields)();

        warnOfIndependentResolveFields(type);

        generatedFields['OR'] = { type: new GraphQLList(getGraphQLFilterType(type, ...excludedFields)) };
        generatedFields['AND'] = { type: new GraphQLList(getGraphQLFilterType(type, ...excludedFields)) };
        generatedFields['NOR'] = { type: new GraphQLList(getGraphQLFilterType(type, ...excludedFields)) };

        return generatedFields;
    };
}

function getGraphQLObjectFilterType(
    type: GraphQLScalarType | GraphQLEnumType | GraphQLNonNull<any> | GraphQLInterfaceType | GraphQLObjectType | GraphQLList<any>,
    ...excludedFields: string[]): GraphQLInputType {
    if (isLeafType(type)) {
        return getGraphQLLeafFilterType(type);
    }

    if (type instanceof GraphQLUnionType) {
        var types = type.getTypes();
        var fields = {};
        types.forEach(function(t) {
            Object.assign(fields, getInputObjectTypeFields(t, ...excludedFields)())
        })
        const unionTypeName = setSuffix(type.name, 'Type', 'ObjectFilterType');
        return cache(typesCache, unionTypeName, () => new GraphQLInputObjectType({
            name: unionTypeName,
            fields: () => fields
        }));
    }

    if (type instanceof GraphQLNonNull) {
        return getGraphQLObjectFilterType(type.ofType);
    }

    if (type instanceof GraphQLList) {
        return getGraphQLObjectFilterType(type.ofType);
    }

    const typeName = setSuffix(type.name, 'Type', 'ObjectFilterType');
    return cache(typesCache, typeName, () => new GraphQLInputObjectType({
        name: typeName,
        fields: getInputObjectTypeFields(type, ...excludedFields)
    }));
}

function getInputObjectTypeFields(type: GraphQLFieldsType, ...excludedFields: string[]): () => FieldMap<GraphQLInputType> {
    return () => {
        const generatedFields = getUnresolvedFieldsTypes(type, getGraphQLObjectFilterType, ...excludedFields)();

        warnOfIndependentResolveFields(type);
        
        generatedFields['opr'] = { type: GetOprExistsType() };

        return generatedFields;
    };
}

function getGraphQLLeafFilterType(leafType: GraphQLLeafType, not: boolean = false): GraphQLInputObjectType {
    const typeName = leafType.toString() + (not ? `Not` : '') + `Filter`;

    return cache(typesCache, typeName, () => new GraphQLInputObjectType({
        name: typeName,
        description: `Filter type for ${(not ? `$not of ` : '')}${leafType} scalar`,
        fields: getGraphQLScalarFilterTypeFields(leafType, not)
    }));
}

function getGraphQLScalarFilterTypeFields(scalarType: GraphQLLeafType, not: boolean): GraphQLInputFieldConfigMap {
    const fields = {
        EQ: { type: scalarType, description: '$eq' },
        GT: { type: scalarType, description: '$gt' },
        GTE: { type: scalarType, description: '$gte' },
        IN: { type: new GraphQLList(scalarType), description: '$in' },
        ALL: { type: new GraphQLList(scalarType), description: '$all' },
        LT: { type: scalarType, description: '$lt' },
        LTE: { type: scalarType, description: '$lte' },
        NE: { type: scalarType, description: '$ne' },
        NIN: { type: new GraphQLList(scalarType), description: '$nin' },
        opr: { type: GetOprExistsType() }
    };

    if (scalarType.name === 'String') {
        enhanceWithRegexFields(fields);
    }

    if (!not) enhanceWithNotField(fields, scalarType);

    return fields;
}

function enhanceWithRegexFields(fields: GraphQLInputFieldConfigMap): void {
    fields.REGEX = { type: GraphQLString, description: '$regex' };
    fields.OPTIONS = { type: GraphQLString, description: '$options. Modifiers for the $regex expression. Field is ignored on its own' };
}

function enhanceWithNotField(fields: GraphQLInputFieldConfigMap, scalarType: GraphQLScalarType | GraphQLEnumType): void {
    fields.NOT = { type: getGraphQLLeafFilterType(scalarType, true), description: '$not' };
}

function warnOfIndependentResolveFields(type: GraphQLFieldsType): void {
    cache(warnedIndependentResolvers, type.toString(), () => {
        const fields =
            getTypeFields(type, (key, field) => 
                field.resolve && (field.extensions.graphqlToMongoDb ? !Array.isArray(field.extensions.graphqlToMongoDb.dependencies) : true))();

        Object.keys(fields).forEach(key =>
            warn(`Field ${key} of type ${type} has a resolve function and no extensions.graphqlToMongoDb.dependencies`));

        return 1;
    });
}
