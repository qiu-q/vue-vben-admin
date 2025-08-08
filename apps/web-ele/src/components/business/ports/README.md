# Port Advanced Renderer

`PortAdvRenderer.vue` is used to render layers of type `port-adv`. It expects the layer
configuration to contain `apiId`, `portDataKey`, `portKey` and a `statusMapping` object.
The component maps real-time port states to icons according to the provided mapping.
