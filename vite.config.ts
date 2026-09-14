import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from '@lovable.dev/vite-tanstack-config'

export default defineConfig({
  plugins: [
    // Tailwind v4: precisa do plugin para processar @import "tailwindcss" source(none)
    // e @source "../src". Sem ele o CSS sai envolto em @media source(none){...} (invalido).
    tailwindcss(),
  ],
  tanstackStart: {
    spa: {
      enabled: false,
    },
  },
})