const Database = require('better-sqlite3');

// Use better-sqlite3 if available, else sqlite3
let db;
try {
  db = new Database('./blog.db');
} catch(e) {
  console.error(e); process.exit(1);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

const posts = [
  {
    title: 'How DNS Works: From Name to IP Address',
    excerpt: 'Every time you type a URL into your browser, DNS translates that human-readable name into a machine-routable IP address — here\'s how.',
    body: `When you type "example.com" into your browser, your computer doesn't know where to send the request — it needs an IP address. This is where the Domain Name System (DNS) steps in.

Your machine first checks its local cache. If the record isn't there, it queries a recursive resolver (usually provided by your ISP or a public resolver like 1.1.1.1). The resolver then climbs the DNS hierarchy: it asks a root nameserver, which points to the TLD nameserver (.com, .org, etc.), which in turn points to the authoritative nameserver for the domain.

The authoritative nameserver holds the actual records — A records for IPv4, AAAA for IPv6, MX for mail, CNAME for aliases, and more. The resolver caches the answer for the duration of the TTL (Time to Live) and returns it to your machine.

The whole round-trip typically takes under 50ms. Without DNS, the internet as we know it would be unusable — no one would memorise 142.250.74.46 just to visit Google.`,
    created_at: '2026-01-10'
  },
  {
    title: 'TCP vs UDP: Choosing the Right Transport Protocol',
    excerpt: 'TCP guarantees delivery and order; UDP trades those guarantees for speed. Understanding the difference is key to designing efficient networked applications.',
    body: `TCP (Transmission Control Protocol) and UDP (User Datagram Protocol) are the two workhorses of the transport layer.

TCP establishes a connection through a three-way handshake (SYN, SYN-ACK, ACK), then ensures every packet is delivered and reassembled in order. Lost packets are retransmitted. This reliability makes TCP ideal for web pages, email, and file transfers — any scenario where data integrity matters more than raw speed.

UDP skips the handshake and makes no delivery guarantees. Packets can arrive out of order or not at all. What you get in return is low overhead and minimal latency. This makes UDP the right choice for DNS queries, video streaming, online gaming, and VoIP — applications where a late packet is worse than a missing one.

A simple rule of thumb: if your application can tolerate some loss but not delay, use UDP. If every byte must arrive intact and in order, use TCP.`,
    created_at: '2026-01-24'
  },
  {
    title: 'Subnetting Explained: Dividing Networks with CIDR',
    excerpt: 'Subnetting lets you carve a large IP block into smaller, manageable segments. CIDR notation makes this process both flexible and compact.',
    body: `An IP address is 32 bits long (IPv4). Without subnetting, the entire address space would be one flat network — unmanageable and insecure. Subnetting solves this by splitting a network into smaller segments called subnets.

CIDR (Classless Inter-Domain Routing) notation expresses both the address and the subnet mask in one compact form. For example, 192.168.1.0/24 means the first 24 bits are the network portion, leaving 8 bits for hosts — that gives you 254 usable host addresses.

A /25 splits that block in two: 192.168.1.0/25 (hosts .1–.126) and 192.168.1.128/25 (hosts .129–.254). Each subdivision doubles the number of subnets and halves the number of hosts per subnet.

Subnetting is essential for routing efficiency, security isolation (putting servers on a separate subnet from workstations), and conserving IP space. With IPv4 exhaustion a reality, careful subnetting remains a critical skill for every network engineer.`,
    created_at: '2026-02-07'
  },
  {
    title: 'VLANs: Logical Network Segmentation on a Physical Switch',
    excerpt: 'A VLAN lets you create multiple isolated broadcast domains on a single physical switch — improving security and simplifying network management.',
    body: `A Virtual LAN (VLAN) partitions a physical network switch into multiple independent logical networks. Devices on different VLANs cannot communicate at Layer 2, even if they share the same hardware — just as if they were on entirely separate switches.

VLANs are defined by IEEE 802.1Q, which inserts a 4-byte tag into Ethernet frames to identify which VLAN the traffic belongs to. Switch ports are configured either as access ports (carrying traffic for a single VLAN, typically used for end devices) or trunk ports (carrying tagged traffic for multiple VLANs, used between switches or to routers).

A classic use case: separating the corporate LAN, a guest Wi-Fi network, and IP cameras onto three VLANs on the same physical infrastructure. Each segment is isolated at Layer 2. Inter-VLAN routing, if needed, is handled by a router or Layer 3 switch with explicit access control lists in between.

VLANs reduce broadcast traffic, contain security incidents, and allow IT teams to apply different policies per segment without running separate cables.`,
    created_at: '2026-02-21'
  },
  {
    title: 'BGP: The Protocol That Routes the Internet',
    excerpt: 'Border Gateway Protocol is the glue of the internet, responsible for exchanging routing information between the tens of thousands of autonomous systems that make up the global network.',
    body: `The internet is not a single network — it's a collection of tens of thousands of independently operated networks called Autonomous Systems (ASes). BGP (Border Gateway Protocol) is the routing protocol that connects them all.

Each AS is assigned a unique ASN (Autonomous System Number) by IANA. BGP peers (neighbours) establish TCP sessions on port 179 and exchange reachability information: "I can reach these IP prefixes, and here is the AS path to get there." Routers choose the best path based on a series of attributes — including AS path length, local preference, MED, and more.

There are two flavours: iBGP (within an AS) and eBGP (between ASes). eBGP is what glues the internet together; your ISP uses eBGP to announce your IP block to the rest of the world.

BGP is famously flexible but also notoriously easy to misconfigure. A single route leak or hijack can misdirect global internet traffic — as demonstrated by several high-profile incidents. Route origin validation via RPKI has emerged as the industry standard for securing BGP announcements.`,
    created_at: '2026-03-08'
  }
];

const insert = db.prepare(
  'INSERT INTO posts (title, excerpt, body, created_at) VALUES (@title, @excerpt, @body, @created_at)'
);

const existing = db.prepare('SELECT COUNT(*) as count FROM posts').get();
if (existing.count === 0) {
  posts.forEach(p => insert.run(p));
  console.log(`Seeded ${posts.length} posts.`);
} else {
  console.log('Database already seeded, skipping.');
}

db.close();
