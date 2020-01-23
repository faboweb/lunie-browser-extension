'use strict'

export default opts => ({
  connection: require(`./connection.js`).default(opts)
})
