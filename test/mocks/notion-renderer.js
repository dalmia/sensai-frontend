// Mock for @udus/notion-renderer
module.exports = {
    components: {
        BlockList: () => null,
        RenderConfig: ({ children }) => children
    },
    styles: {
        globals: {
            css: ''
        }
    }
}; 