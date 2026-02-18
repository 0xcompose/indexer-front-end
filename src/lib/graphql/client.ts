import { GraphQLClient } from 'graphql-request';
import { env } from '$env/dynamic/public';

const url = env.PUBLIC_GRAPHQL_URL ?? 'http://localhost:8080/v1/graphql';

export const gqlClient = new GraphQLClient(url);
