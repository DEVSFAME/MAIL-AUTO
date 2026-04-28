# Graph Report - Automatisation MAIL  (2026-04-28)

## Corpus Check
- 7 files · ~13,547 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 46 nodes · 84 edges · 6 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `loadContacts()` - 9 edges
2. `showToast()` - 8 edges
3. `api()` - 8 edges
4. `init()` - 6 edges
5. `authenticate()` - 6 edges
6. `sendEmail()` - 6 edges
7. `loadDocuments()` - 5 edges
8. `handleSend()` - 5 edges
9. `handleDelete()` - 5 edges
10. `uploadFile()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `uploadDocuments()` --calls--> `showToast()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 0 → community 8_
- `uploadFile()` --calls--> `showToast()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 0 → community 4_
- `checkAuth()` --calls--> `api()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 0 → community 3_
- `init()` --calls--> `showAppSection()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 7 → community 3_
- `uploadFile()` --calls--> `loadDocuments()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 8 → community 4_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.42
Nodes (9): api(), closeModal(), handleDelete(), handleEdit(), handleSend(), handleSendAll(), loadContacts(), openSendAllModal() (+1 more)

### Community 1 - "Community 1"
Cohesion: 0.57
Nodes (7): authenticate(), buildEnvelope(), escapeXml(), sendEmail(), soapRequest(), testConnection(), uploadAttachment()

### Community 3 - "Community 3"
Cohesion: 0.5
Nodes (4): checkAuth(), handleLogout(), init(), showLoginSection()

### Community 4 - "Community 4"
Cohesion: 0.5
Nodes (4): getFilteredContacts(), renderContacts(), updateStats(), uploadFile()

### Community 7 - "Community 7"
Cohesion: 0.67
Nodes (3): getInitials(), openModal(), showAppSection()

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (3): loadDocuments(), renderDocuments(), uploadDocuments()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadContacts()` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 0` to `Community 8`, `Community 2`, `Community 4`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `api()` connect `Community 0` to `Community 8`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._