# Graph Report - Automatisation MAIL  (2026-05-03)

## Corpus Check
- 10 files · ~22,236 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 68 nodes · 137 edges · 8 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `api()` - 11 edges
2. `showToast()` - 10 edges
3. `loadContacts()` - 9 edges
4. `handleBatchSend()` - 9 edges
5. `renderContacts()` - 8 edges
6. `handleBatchPending()` - 8 edges
7. `authenticate()` - 8 edges
8. `sendEmail()` - 8 edges
9. `exitSelectMode()` - 7 edges
10. `handleBatchDelete()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `sendGmail()` --calls--> `mimeEncodeHeader()`  [INFERRED]
  server.js → src/zimbra-client.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.29
Nodes (17): addBatchLog(), api(), closeBatchModal(), closeModal(), exitSelectMode(), handleBatchConfirm(), handleBatchDelete(), handleBatchPending() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.27
Nodes (12): authenticate(), buildEnvelope(), escapeXml(), mimeEncodeHeader(), parseAttachmentId(), parseAuthToken(), parseLifetime(), parseSoapFault() (+4 more)

### Community 2 - "Community 2"
Cohesion: 0.25
Nodes (2): openBatchModal(), openSendAllModal()

### Community 3 - "Community 3"
Cohesion: 0.6
Nodes (5): getFilteredContacts(), renderContactSelection(), selectAllContacts(), toggleSelectContact(), updateBatchUI()

### Community 4 - "Community 4"
Cohesion: 0.5
Nodes (4): checkAuth(), handleLogout(), init(), showLoginSection()

### Community 6 - "Community 6"
Cohesion: 0.67
Nodes (1): sendGmail()

### Community 7 - "Community 7"
Cohesion: 0.67
Nodes (3): loadDocuments(), renderDocuments(), uploadDocuments()

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (3): getInitials(), openModal(), showAppSection()

## Knowledge Gaps
- **Thin community `Community 2`** (8 nodes): `$()`, `formatDate()`, `formatSize()`, `handleEdit()`, `app.js`, `openBatchModal()`, `openSendAllModal()`, `truncate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (3 nodes): `generateEmail()`, `sendGmail()`, `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mimeEncodeHeader()` connect `Community 1` to `Community 6`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `sendGmail()` connect `Community 6` to `Community 1`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._