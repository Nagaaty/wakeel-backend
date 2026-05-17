const fs = require('fs');
let code = fs.readFileSync('mobile/app/(tabs)/forum.tsx', 'utf8');

// Insert import
code = code.replace(
  "import { useForumSocket } from '../../src/hooks/useForumSocket';",
  "import { useForumSocket } from '../../src/hooks/useForumSocket';\nimport { PostCard } from '../../src/components/forum/PostCard';"
);

// We want to replace everything from `const origData = p.original_post_data`
// to the closing of the renderItem `/>` that corresponds to it.

// Let's use a regular expression or substring search.
const startStr = '          const origData = p.original_post_data';
const endStr = '          );\n        }}\n      />';

const startIdx = code.indexOf(startStr);
let endIdx = code.indexOf(endStr, startIdx);

if (endIdx === -1) {
    // Try an alternative ending pattern
    const altEnd = '/>';
    // Find the indexOf '/>' after the startIdx
    // Actually the renderItem closes with a flatlist `/>` but we need to stop before that.
    const searchString = '      />';
    let idx = code.indexOf('/>', startIdx);
    while (idx !== -1) {
        let snippet = code.substring(idx - 20, idx + 10);
        if (snippet.includes('}\n      />')) {
            endIdx = idx - 18; // roughly
            break;
        }
        idx = code.indexOf('/>', idx + 2);
    }
}

if (startIdx === -1) {
    console.log('Failed finding startIdx');
    process.exit(1);
}

// Safer approach: Split by the start marker and end marker exactly
const parts = code.split('const origData = p.original_post_data');
let secondPart = parts[1];

let resultStr = '          return (\n            <PostCard\n              key={p.id}\n              p={p}\n              C={C}\n              user={user}\n              isRTL={isRTL}\n              liked={likedPosts.has(p.id)}\n              disliked={dislikedPosts.has(p.id)}\n              saved={savedPosts.has(p.id)}\n              onLike={handleLike}\n              onDislike={handleDislike}\n              onSave={handleSave}\n              onComment={openComments}\n              onShare={handleShare}\n              onNativeShare={handleNativeShare}\n              onImageTap={setLightboxUri}\n              onMenuTap={setMenuPost}\n              onReactorsTap={openReactors}\n              catStyle={catStyle}\n            />\n          );\n        }}\n      />';

let closingIndex = secondPart.indexOf('          );\n        }\n      />');

if (closingIndex !== -1) {
   let afterRenderItem = secondPart.substring(closingIndex + '          );\n        }\n      />'.length);
   let finalCode = parts[0] + resultStr + afterRenderItem;
   fs.writeFileSync('mobile/app/(tabs)/forum.tsx', finalCode);
   console.log('Success (method 1)!');
} else {
   closingIndex = secondPart.indexOf('        }}\n      />');
   if (closingIndex !== -1) {
       let afterRenderItem = secondPart.substring(closingIndex + '        }}\n      />'.length);
       let finalCode = parts[0] + resultStr + afterRenderItem;
       fs.writeFileSync('mobile/app/(tabs)/forum.tsx', finalCode);
       console.log('Success (method 2)!');
   } else {
       console.log('Could not parse closing lines.');
   }
}
