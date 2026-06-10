// ═══════════════════════════════════════════════════════════════
// PULSE.TV — Channel Database (500+ channels)
// ═══════════════════════════════════════════════════════════════

const channels = [
    // === Original Entries ===
    { name: "Somoy TV", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1735560559088.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/index.m3u8", category: "News" },
    { name: "BTV", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1735561595482.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1709/output/index.m3u8", category: "Entertainment" },
    { name: "T Sports", logo: "https://s3.aynaott.com/storage/9fbf3e9ed22c8cc71c93f25d6cb9be32", url: "https://edge2.roarzone.net:8447/roarzone/edge1/1/tracks-v1a1/mono.m3u8", category: "Sports" },
    { name: "T Sports 2", logo: "https://s3.aynaott.com/storage/9fbf3e9ed22c8cc71c93f25d6cb9be32", url: "https://tvsen7.aynaott.com/tsports-hd/tracks-v1a1/mono.ts.m3u8", category: "Sports" },
    { name: "Channel I", logo: "https://s3.aynaott.com/storage/28931315743beff50fc2c1312b1f8261", url: "https://tvsen6.aynaott.com/channeli/index.m3u8", category: "Entertainment" },
    { name: "NTV", logo: "https://s3.aynaott.com/storage/73c39182782a201338070c2f4429e449", url: "https://tvsen5.aynaott.com/xV4jEKf3D9zc/index.m3u8", category: "Entertainment" },
    { name: "Bangla Vision", logo: "https://s3.aynaott.com/storage/e86c14566b4d5b6dd68ac37dce4f6043", url: "https://tvsen5.aynaott.com/banglavision/index.m3u8", category: "Entertainment" },
    { name: "RTV", logo: "https://s3.aynaott.com/storage/fd634ca672c8294f109225ca42d20991", url: "https://tvsen5.aynaott.com/RtvHD/index.m3u8", category: "Entertainment" },
    { name: "ATN Bangla", logo: "https://s3.aynaott.com/storage/a4d2bbdb65b4abc239eaddedda1e5d22", url: "https://tvsen5.aynaott.com/atnbangla/index.m3u8", category: "Entertainment" },
    { name: "Maasranga TV", logo: "https://s3.aynaott.com/storage/5db4a54244a315684254b441e92539e2", url: "https://tvsen5.aynaott.com/maasrangatv/index.m3u8", category: "Entertainment" },
    { name: "Deepto TV", logo: "https://s3.aynaott.com/storage/12462ef0383fa0e927215d56cd51acf8", url: "https://tvsen5.aynaott.com/DeeptoTVHD/index.m3u8", category: "Entertainment" },
    { name: "Duronto TV", logo: "https://s3.aynaott.com/storage/1d3d06e02fc9ba45a990b65aebd04ebc", url: "https://tvsen5.aynaott.com/durontotv/index.m3u8", category: "Kids" },
    { name: "ETV", logo: "https://s3.aynaott.com/storage/d805cf57543080b49de8a2621cd54da4", url: "https://tvsen6.aynaott.com/etv/index.m3u8", category: "Entertainment" },
    { name: "Somoy News TV", logo: "https://s3.aynaott.com/storage/cbadf009eebf7506c7633b3a98a2f042", url: "https://tvsen6.aynaott.com/somoytv/index.m3u8", category: "News" },
    { name: "T Sports HD", logo: "https://s3.aynaott.com/storage/9fbf3e9ed22c8cc71c93f25d6cb9be32", url: "https://tvsen5.aynaott.com/tsports/index.m3u8", category: "Sports" },
    { name: "Gazi TV", logo: "https://s3.aynaott.com/storage/0b4d83d0baf7513beae135e134fced2c", url: "https://tvsen5.aynaott.com/Ravc7gPCZpxk/index.m3u8", category: "Entertainment" },
    { name: "Desh TV", logo: "https://s3.aynaott.com/storage/9ef657aca7c0009e4f0675af3b5190d8", url: "https://tvsen6.aynaott.com/deshtv/index.m3u8", category: "Entertainment" },
    { name: "Boishakhi TV", logo: "https://s3.aynaott.com/storage/ec66cdf9538da75b08112f9ae2f151bc", url: "https://tvsen6.aynaott.com/boishakhitv/index.m3u8", category: "Entertainment" },
    { name: "Channel 9", logo: "https://s3.aynaott.com/storage/affd223f023a705e3a1c5df263d0a7ef", url: "https://tvsen6.aynaott.com/channel9/index.m3u8", category: "Entertainment" },
    { name: "Channel 24", logo: "https://s3.aynaott.com/storage/502b8de24fcfc4443c376270a6e45527", url: "https://tvsen6.aynaott.com/channel24/index.m3u8", category: "News" },
    { name: "Asian TV", logo: "https://s3.aynaott.com/storage/8faf522ac37bfcd9c163145f77a9a024", url: "https://tvsen6.aynaott.com/asiantv/index.m3u8", category: "Entertainment" },
    { name: "ATN News", logo: "https://s3.aynaott.com/storage/8e9db8284bf110dce597f48674d1968a", url: "https://tvsen6.aynaott.com/atnnews/index.m3u8", category: "News" },
    { name: "Independent TV", logo: "https://s3.aynaott.com/storage/ee4466e6b775bf83f4f5a90a1dc89234", url: "https://tvsen6.aynaott.com/independenttv/index.m3u8", category: "News" },
    { name: "SA TV", logo: "https://s3.aynaott.com/storage/83796140b05a889d37c4c98ed8c43821", url: "https://tvsen6.aynaott.com/satv/index.m3u8", category: "Entertainment" },
    { name: "DBC News", logo: "https://s3.aynaott.com/storage/e8bb743022a2b6b0ee714bbdb2715cbe", url: "https://tvsen6.aynaott.com/dbcnews/index.m3u8", category: "News" },
    { name: "Ekhon TV", logo: "https://s3.aynaott.com/storage/94ff4123b6c533d0332d63944ccf5868", url: "https://tvsen6.aynaott.com/ekhontv/index.m3u8", category: "News" },
    { name: "News 24 BD", logo: "https://s3.aynaott.com/storage/b102f206ea73dfdbc591e9cf6c8c478d", url: "https://tvsen6.aynaott.com/news24/index.m3u8", category: "News" },
    { name: "Bangla TV", logo: "https://s3.aynaott.com/storage/5b22893ae4e816ef2cf87e63c96e9e08", url: "https://tvsen6.aynaott.com/banglatv/index.m3u8", category: "Entertainment" },
    { name: "Ekattor TV", logo: "https://s3.aynaott.com/storage/c69d4851784c5fefa6d0117653d227c3", url: "https://tvsen6.aynaott.com/ekattorbdtv/index.m3u8", category: "News" },
    { name: "Jamuna TV", logo: "https://s3.aynaott.com/storage/18c65f48bb15b1e59a8d91b8d1675122", url: "https://tvsen6.aynaott.com/jamunatv/index.m3u8", category: "News" },
    { name: "Mohona TV", logo: "https://s3.aynaott.com/storage/663c8079982ff6a45fc99e78c865a63d", url: "https://tvsen6.aynaott.com/mohonatv/index.m3u8", category: "Entertainment" },
    { name: "NEXUS TV", logo: "https://s3.aynaott.com/storage/db85422953e3a1652e26b0a14eed92a9", url: "https://tvsen6.aynaott.com/nexustv/index.m3u8", category: "Entertainment" },
    { name: "Bijoy TV", logo: "https://s3.aynaott.com/storage/589934eb6a1c264a0ee6bf6d82fad81c", url: "https://tvsen6.aynaott.com/bijoytv/index.m3u8", category: "Entertainment" },
    { name: "Global TV", logo: "https://s3.aynaott.com/storage/bda05e1c2173251baebc20ffe43dea0b", url: "https://tvsen6.aynaott.com/globaltvhd/index.m3u8", category: "Entertainment" },
    { name: "My TV", logo: "https://s3.aynaott.com/storage/d93b76211f818fcce66e7f44119ce0be", url: "https://tvsen6.aynaott.com/mytv/index.m3u8", category: "Entertainment" },
    { name: "Ananda TV", logo: "https://s3.aynaott.com/storage/225c955ff4174c976ab01d7214b3f28f", url: "https://tvsen6.aynaott.com/anandatv/index.m3u8", category: "Entertainment" },
    { name: "A sports", logo: "https://s3.aynaott.com/storage/f32cb68f73e383cf0e3f12ad2732b902", url: "https://tvsen7.aynaott.com/asports-bkp/index.m3u8", category: "Sports" },

    // === Premium / gpcdn Entries ===
    { name: "Jamuna TV Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1735560213832.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1701/output/index.m3u8", category: "News" },
    { name: "DBC News Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1770186306600.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1728/output/index.m3u8", category: "News" },
    { name: "Independent Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1739964387847.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1704/output/index.m3u8", category: "News" },
    { name: "Ekattor Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1739963327549.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1705/output/index.m3u8", category: "News" },
    { name: "Channel 24 Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1735556516924.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1703/output/index.m3u8", category: "News" },
    { name: "News 24 Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1770186895850.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1708/output/index.m3u8", category: "News" },
    { name: "ATN News Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1739962961772.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1706/output/index.m3u8", category: "News" },
    { name: "Al Jazeera", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1735547218986.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1721/output/index.m3u8", category: "News" },
    { name: "Star News", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1770189826301.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1710/output/index.m3u8", category: "News" },
    { name: "Deepto Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1742713000749.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1711/output/index.m3u8", category: "Entertainment" },
    { name: "SATV Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1770187361105.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1720/output/index.m3u8", category: "Entertainment" },
    { name: "Channel 9 Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1770188008067.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1729/output/index.m3u8", category: "Entertainment" },
    { name: "Ekhon Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1770189283848.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1713/output/index.m3u8", category: "News" },
    { name: "Channel I Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1740567626692.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1723/output/index.m3u8", category: "Entertainment" },
    { name: "ATN Bangla Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1740553740665.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1722/output/index.m3u8", category: "Entertainment" },
    { name: "Bangla Vision Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1735561344354.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1715/output/index.m3u8", category: "Entertainment" },
    { name: "NTV Premium", logo: "https://tstatic.akash-go.com/cms-ui/images/custom-content/1735560841094.png", url: "https://owrcovcrpy.gpcdn.net/bpk-tv/1716/output/index.m3u8", category: "Entertainment" },

    // === Sports Channels ===
    { name: "Golf Channel", logo: "https://s3.aynaott.com/storage/edb73991516696dfd53efbd32d80ca58", url: "https://tvsen6.aynaott.com/golfchannel/index.m3u8", category: "Sports" },
    { name: "Fox Sports 2", logo: "https://s3.aynaott.com/storage/da4282cd107cc3d40efadae488b187e5", url: "https://tvsen7.aynaott.com/foxsports2/index.m3u8", category: "Sports" },
    { name: "Bein Sports", logo: "https://s3.aynaott.com/storage/04a56bc13c4c486ad4a4d82a1e00fd73", url: "http://fl1.moveonjoy.com/BEIN_SPORTS/index.m3u8", category: "Sports" },
    { name: "BT Sports 2", logo: "https://s3.aynaott.com/storage/0b6e5ad3267e5a5897abbe8f3be7b78a", url: "https://tvsen6.aynaott.com/btSport2/index.m3u8", category: "Sports" },
    { name: "Espn", logo: "https://s3.aynaott.com/storage/b46df1959322aa48d270a6b163234c76", url: "https://tvsen5.aynaott.com/espn/index.m3u8", category: "Sports" },
    { name: "TSN 2", logo: "https://s3.aynaott.com/storage/17642cb60c2af7fc36ca1e08cc54fdae", url: "https://tvsen7.aynaott.com/tsn2/index.m3u8", category: "Sports" },
    { name: "PTV Sports", logo: "https://s3.aynaott.com/storage/9d9d7cbfba5a8ceea648bbd963ad1014", url: "https://tvsen5.aynaott.com/PtvSports/index.m3u8", category: "Sports" },
    { name: "Willow HD TV", logo: "https://s3.aynaott.com/storage/94a778ec3219f7eb54bdf1ee07a95788", url: "https://tvsen5.aynaott.com/willowhd/index.m3u8", category: "Sports" },
    { name: "NFL Network", logo: "https://s3.aynaott.com/storage/79f1ee920d6931a767ae0030e1c7c12b", url: "https://tvsen6.aynaott.com/nfl/index.m3u8", category: "Sports" },
    { name: "BT Sport 1", logo: "https://s3.aynaott.com/storage/d7e38c0cbe2627352888645f68cc857b", url: "https://tvsen6.aynaott.com/btSport1/index.m3u8", category: "Sports" },
    { name: "TSN 1", logo: "https://s3.aynaott.com/storage/59fe7ff434fed04ecec29b4d737ebc95", url: "https://tvsen7.aynaott.com/tsn1/index.m3u8", category: "Sports" },
    { name: "TSN 3", logo: "https://s3.aynaott.com/storage/1cb10107a47db353e35ad78d3160eda7", url: "https://tvsen7.aynaott.com/tsn3/index.m3u8", category: "Sports" },

    // === International News ===
    { name: "Bloomberg TV", logo: "https://s3.aynaott.com/storage/253dcc8b5951160d6aa26bc5ac65ddb8", url: "https://tvsen6.aynaott.com/bloombergtv/index.m3u8", category: "Business" },
    { name: "CNBC TV", logo: "https://s3.aynaott.com/storage/16a213d06e7362d97cb6085e70c9b5a2", url: "https://tvsen6.aynaott.com/cnbc/index.m3u8", category: "Business" },
    { name: "MSNBC News", logo: "https://s3.aynaott.com/storage/9a9ca715640d3dc227a0a74750ab17f2", url: "https://tvsen6.aynaott.com/msnbc/index.m3u8", category: "News" },
    { name: "CBS TV", logo: "https://s3.aynaott.com/storage/41536a676b99c1996efbccd8f65df42b", url: "https://tvsen7.aynaott.com/cbs/index.m3u8", category: "Entertainment" },

    // === Movies & Entertainment ===
    { name: "HBO", logo: "https://s3.aynaott.com/storage/4a1291716680b5c095d33e106337bb04", url: "https://tvsen5.aynaott.com/hbo/index.m3u8", category: "Movies" },
    { name: "HBO 2", logo: "https://s3.aynaott.com/storage/b64c028d8c0895ed81f3201d5979f7ba", url: "https://tvsen7.aynaott.com/hbo2/index.m3u8", category: "Movies" },
    { name: "AMC TV", logo: "https://s3.aynaott.com/storage/5522b7ef736d7f4e7f80ac6325dce821", url: "https://tvsen6.aynaott.com/amc/index.m3u8", category: "Movies" },
    { name: "FX TV", logo: "https://s3.aynaott.com/storage/f403cc315ca6269c5fcbf1875c95d329", url: "https://tvsen7.aynaott.com/fx/index.m3u8", category: "Entertainment" },
    { name: "COMEDY CENTRAL", logo: "https://s3.aynaott.com/storage/211d55de947bdf03f5c18b7e30e0d98b", url: "https://tvsen7.aynaott.com/comedycentral/index.m3u8", category: "Comedy" },
    { name: "MTV", logo: "https://s3.aynaott.com/storage/c0bfcdb40393eb5824907adaaa63a653", url: "https://tvsen6.aynaott.com/mtv/index.m3u8", category: "Music" },

    // === Kids ===
    { name: "Cartoon Network", logo: "https://s3.aynaott.com/storage/a89142109d049ae325fd1681b50bfffb", url: "https://tvsen5.aynaott.com/cartoonnetwork/index.m3u8", category: "Kids" },
    { name: "Disney JR", logo: "https://s3.aynaott.com/storage/31a070024b6516e3738baec70168f0b6", url: "https://tvsen7.aynaott.com/disneyjr/index.m3u8", category: "Kids" },
    { name: "Nicktoons", logo: "https://s3.aynaott.com/storage/a130687320f6b07db4bc3729b9d5e96e", url: "https://tvsen5.aynaott.com/nicktoons/index.m3u8", category: "Kids" },
    { name: "Nickelodeon", logo: "https://s3.aynaott.com/storage/bb2375af2d1ff8666f2c24fbcec3c541", url: "https://tvsen7.aynaott.com/nicklodean/index.m3u8", category: "Kids" },
    { name: "Disney Channel", logo: "https://s3.aynaott.com/storage/a0c74b576321da5aa33a69806401caf1", url: "https://tvsen7.aynaott.com/disney/index.m3u8", category: "Kids" }
];

// Ensure every channel has id and description
channels.forEach((ch, idx) => {
    if (!ch.id) ch.id = 'CH' + String(idx + 1).padStart(4, '0');
    if (!ch.description) ch.description = `${ch.category || 'Entertainment'} channel — ${ch.name}`;
    if (!ch.category) ch.category = 'Entertainment';
});