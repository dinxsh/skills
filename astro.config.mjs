import { defineConfig } from 'astro/config';
import react from "@astrojs/react";
import netlify from "@astrojs/netlify";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: 'https://skills.goldrush.dev',
  integrations: [react(), partytown(
    {
      config: {
        forward: ["dataLayer.push"],
      },
    }
  ), sitemap({
    serialize(item) {
      if (item.url === 'https://skills.goldrush.dev/') return { ...item, priority: 1.0, changefreq: 'weekly' };
      if (item.url === 'https://skills.goldrush.dev/kits') return { ...item, priority: 0.9, changefreq: 'weekly' };
      if (item.url.startsWith('https://skills.goldrush.dev/kits/')) return { ...item, priority: 0.8, changefreq: 'monthly' };
      if (item.url.startsWith('https://skills.goldrush.dev/tools/')) return { ...item, priority: 0.7, changefreq: 'monthly' };
      return { ...item, priority: 0.5 };
    },
  })],

  adapter: netlify()
});