import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.save.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const user1 = await prisma.user.create({
    data: {
      username: "studioarchi",
      phone: "+12025550101",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      username: "elena_scandi",
      phone: "+12025550102",
      avatar:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    },
  });

  const user3 = await prisma.user.create({
    data: {
      username: "kuro_space",
      phone: "+12025550103",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    },
  });

  const user4 = await prisma.user.create({
    data: {
      username: "rossidesign",
      phone: "+12025550104",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    },
  });

  // Seed Posts with stringified images and tags (matching SQLite schema)
  const postsData = [
    {
      title: "Minimalist brutalist pavilion in concrete & glass",
      content:
        "Exploration of heavy geometric forms meeting transparent glass facades in a woodland clearing.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Architecture", "concrete", "brutalism"]),
      authorId: user1.id,
    },
    {
      title: "Nordic ceramics & soft morning light",
      content:
        "Hand-thrown porcelain vessels capturing natural raking morning illumination on raw oak.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Design", "ceramics", "scandi"]),
      authorId: user2.id,
    },
    {
      title: "Monolithic stairs cut through volcanic stone",
      content:
        "Subterranean staircase carved straight into basalt rock with recessed linear illumination.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Architecture", "monolith", "minimalism"]),
      authorId: user3.id,
    },
    {
      title: "Warm timber tones & quiet reading nook",
      content:
        "A peaceful sanctuary with floor-to-ceiling bookshelves in smoked European oak.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Interior", "furniture", "woodcraft"]),
      authorId: user4.id,
    },
    {
      title: "Raw linen textiles in earthy palette",
      content:
        "Tactile woven organic fabrics reflecting sunbaked Mediterranean clays and umbers.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Interior", "textiles", "organic"]),
      authorId: user2.id,
    },
    {
      title: "Sculptural bronze chair study No. 04",
      content:
        "Limited edition casting exploring the boundary between functional seating and sculpture.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Design", "bronze", "sculpture"]),
      authorId: user1.id,
    },
    {
      title: "Geometric shadows across sandstone patio",
      content:
        "Midday high-contrast shadows casting sharp silhouettes along textured desert limestone.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Minimal", "shadow", "patio"]),
      authorId: user3.id,
    },
    {
      title: "Curved plaster walls & recessed skylight",
      content:
        "Organic architectural geometry diffusing daylight through smooth venetian plaster.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Architecture", "plaster", "curves"]),
      authorId: user1.id,
    },
    {
      title: "Japanese tea room in hinoki cedar",
      content:
        "Traditional joinery without screws or nails, bathed in diffused shoji paper daylight.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Minimal", "hinoki", "japan"]),
      authorId: user3.id,
    },
    {
      title: "Abstract marble slab with emerald veins",
      content:
        "Rare Italian serpentine marble cut for a floating cantilevered island.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Art", "marble", "texture"]),
      authorId: user4.id,
    },
    {
      title: "Mid-century lounge with terracotta fireplace",
      content:
        "Warm conversational living room centering around a handmade flared terracotta hearth.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Interior", "terracotta", "midcentury"]),
      authorId: user2.id,
    },
    {
      title: "Coastline pavilion hovering above the cliffs",
      content:
        "Cantilevered steel and structural glass hanging over the turbulent Pacific horizon.",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
      ]),
      tags: JSON.stringify(["Architecture", "cliff", "ocean"]),
      authorId: user1.id,
    },
  ];

  for (const p of postsData) {
    const created = await prisma.post.create({ data: p });
    // Add sample saves
    await prisma.save.create({
      data: {
        userId: user1.id,
        postId: created.id,
      },
    });
  }

  console.log(`Seeded ${postsData.length} posts and 4 users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

