# Marketing Spend Category Taxonomy — canonical source

This is the authoritative category/subcategory taxonomy for the portal, transcribed from
`Marketing Expense Portal.md` (the detailed A–Q table, which supersedes that same document's
earlier flat 16-item list — the two didn't map 1:1, and this table is the more refined version).

It is seeded into the `categories`/`subcategories` tables by an Alembic data migration — **this
file is the source of truth for that migration**, not the other way around. If the taxonomy needs
to change later, edit it here first, then add a new migration.

Category **Q. Other** requires a mandatory free-text description when selected
(`categories.requires_freetext_description = true`, enforced in the API/service layer, with a DB
`CHECK` as defense in depth).

| Code | Category | Subcategories / spend-type examples |
|---|---|---|
| A | Conferences & Events | Conference registration; Delegate passes; Speaker registration; Booth/exhibition space; Sponsorship package; Speaking slot; Event branding; Banner; Backdrop; Booth construction; AV equipment; Event collateral; Swag; Shipping; Event staff; Hospitality; Customer dinner; Networking event; Side event; Event photography/video |
| B | Advertising & Paid Promotion | Google Ads; LinkedIn Ads; Meta Ads; YouTube Ads; Display advertising; Retargeting; Sponsored content; Newsletter sponsorship; Industry publication advertising; Marketplace advertising; Job-board advertising (marketing-related); Campaign-specific paid promotion |
| C | Content & Creative | Video production; Product videos; Explainer videos; Photography; Graphic design; Motion graphics; Copywriting; Blog/content production; Case studies; Whitepapers; eBooks; Brochures; Infographics; Creative agencies; Freelancers |
| D | Branding & Merchandise | T-shirts; Hoodies; Caps; Bags; Pens; Notebooks; Mugs; Corporate gifts; Conference giveaways; Printed materials; Banners; Standees; Office branding; Event branding |
| E | Travel & Accommodation | Flights; Hotels; Local transportation; Airport transfers; Car rental; Meals; Per diem; Visa; Travel insurance; Conference-related travel |
| F | Customer / Prospect Engagement | Customer dinners; Executive dinners; Client events; Prospect events; Hospitality; Networking events; Customer gifts; Prospect gifts; Entertainment; Roundtables; Workshops; Executive briefings |
| G | Digital Marketing | SEO; SEM; Website campaigns; Landing pages; Email campaigns; Marketing automation; Social media campaigns; Influencer marketing; Affiliate marketing; Online directories; Review platforms |
| H | Marketing Technology | Marketing SaaS; Analytics tools; SEO tools; Email platforms; CRM-related marketing tools; Social media tools; Content management tools; Design tools; Video tools; Webinar platforms; Lead-generation platforms; Data providers; Marketing AI tools |
| I | PR & Communications | PR agency; Press releases; Media outreach; Journalist engagement; Media monitoring; PR campaigns; Awards; Award submissions; Industry publications; Thought leadership |
| J | Analyst / Industry Relations | Analyst subscriptions; Analyst briefings; Research reports; Analyst events; Industry memberships; Industry associations; Research studies |
| K | Partnerships & Co-Marketing | Partner events; Joint campaigns; Co-branded campaigns; Partner sponsorship; MDF-related expenditure; Partner collateral; Partner webinars; Partner content |
| L | Website & Digital Presence | Website development specifically for marketing; Landing pages; Domain purchases; Hosting; CDN; Website plugins; Design; Conversion optimization; Tracking/analytics |
| M | Awards & Recognition | Award entry fees; Submission fees; Award sponsorship; Award ceremony tickets; Creative production; PR around award wins |
| N | Research & Intelligence | Market research; Customer research; Surveys; Industry reports; Competitive intelligence; Research agencies; Data purchases |
| O | Memberships & Associations | Industry memberships; Professional associations; Chamber memberships; Marketing organizations; Conference memberships |
| P | Internal Marketing Initiatives | Internal campaigns; Employer branding; Internal events; Employee advocacy; Internal promotional material; Recruitment marketing |
| Q | Other | Other Marketing Spend — description required |
