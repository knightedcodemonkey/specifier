require.resolve('./require/file.js')
import.meta.resolve('./meta/file.js')

const obj = {}
obj.resolve = function() {}
obj.resolve('./skip/file.js')
