# Graph Report - Automatisation MAIL  (2026-05-02)

## Corpus Check
- 10 files · ~21,350 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 63 nodes · 128 edges · 8 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]

## God Nodes (most connected - your core abstractions)
1. `api()` - 11 edges
2. `showToast()` - 10 edges
3. `loadContacts()` - 9 edges
4. `handleBatchSend()` - 9 edges
5. `renderContacts()` - 8 edges
6. `handleBatchPending()` - 8 edges
7. `exitSelectMode()` - 7 edges
8. `handleBatchDelete()` - 7 edges
9. `sendEmail()` - 7 edges
10. `init()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `uploadDocuments()` --calls--> `showToast()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 0 → community 8_
- `handleBatchSend()` --calls--> `showToast()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 0 → community 1_
- `checkAuth()` --calls--> `api()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 0 → community 6_
- `init()` --calls--> `showAppSection()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 9 → community 6_
- `handleLogout()` --calls--> `exitSelectMode()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 6 → community 1_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.33
Nodes (10): api(), closeModal(), handleDelete(), handleSendAllConfirm(), handleSendOne(), loadContacts(), openBatchModal(), openSendAllModal() (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.42
Nodes (9): addBatchLog(), closeBatchModal(), exitSelectMode(), handleBatchConfirm(), handleBatchDelete(), handleBatchPending(), handleBatchSend(), renderContacts() (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.5
Nodes (8): authenticate(), buildEnvelope(), escapeXml(), mimeEncodeHeader(), sendEmail(), soapRequest(), testConnection(), uploadAttachment()

### Community 4 - "Community 4"
Cohesion: 0.6
Nodes (5): getFilteredContacts(), renderContactSelection(), selectAllContacts(), toggleSelectContact(), updateBatchUI()

### Community 5 - "Community 5"
Cohesion: 0.67
Nodes (2): mimeEncodeHeader(), sendGmail()

### Community 6 - "Community 6"
Cohesion: 0.5
Nodes (4): checkAuth(), handleLogout(), init(), showLoginSection()

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (3): loadDocuments(), renderDocuments(), uploadDocuments()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (3): getInitials(), openModal(), showAppSection()

## Knowledge Gaps
- **Thin community `Community 5`** (4 nodes): `generateEmail()`, `mimeEncodeHeader()`, `sendGmail()`, `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `api()` connect `Community 0` to `Community 8`, `Community 1`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 0` to `Community 8`, `Community 1`, `Community 3`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `handleBatchSend()` connect `Community 1` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._