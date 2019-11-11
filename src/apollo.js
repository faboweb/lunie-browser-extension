import { ApolloClient } from 'apollo-boost'
import { createPersistedQueryLink } from 'apollo-link-persisted-queries'
import { createHttpLink } from 'apollo-link-http'
import { WebSocketLink } from 'apollo-link-ws'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { split } from 'apollo-link'
import { getMainDefinition } from 'apollo-utilities'

const makeHttpLink = url => {
  // We create a createPersistedQueryLink to lower network usage.
  // With this, a prefetch is done using a hash of the query.
  // if the server recognises the hash, it will reply with the full reponse.
  return createPersistedQueryLink().concat(
    createHttpLink({
      uri: url
    })
  )
}

const makeWebSocketLink = url => {
  const host = url
  const uri = `${host.replace('http', 'ws')}/graphql`
  return new WebSocketLink({ uri })
}

const createApolloClient = url => {
  const link = split(
    ({ query }) => {
      const definition = getMainDefinition(query)
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      )
    },
    makeWebSocketLink(url),
    makeHttpLink(url)
  )

  const cache = new InMemoryCache()

  return new ApolloClient({
    link,
    cache,
    connectToDevTools: true
  })
}

export const createApolloProvider = url => {
  return createApolloClient(url)
}
