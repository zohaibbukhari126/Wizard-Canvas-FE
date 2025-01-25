module.export = {
    plugins: {
        'postcss-preset-mantine': {},
        'postcss-simple-vars': {
            variables: {
                'mantine-breakpoint-xs' : '400px',
                'mantine-breakpoint-sm' : '600px',
                'mantine-breakpoint-md' : '900px',
                'mantine-breakpoint-lg' : '1200px',
                'mantine-breakpoint-xl' : '1600px',
            },
        },
    },
}; 