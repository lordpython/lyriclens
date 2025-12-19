import { SongData, ImagePrompt, GeneratedImage } from '../types';
import { parseSRT } from './srtParser';

// Browser-compatible test data (no Node.js fs module)
export const createTestSongData = (): SongData => {
  console.log('🎵 Creating test song data...');

  // Mock SRT content for "the true Saba"
  const srtContent = `1
00:00:51,539 --> 00:00:57,289
Oh, you who trick the soul with hopes that fade,

2
00:00:58,709 --> 00:01:04,019
this world is but a shadow and a shade.

3
00:01:05,489 --> 00:01:11,549
You weep for life, yet deep inside you know,

4
00:01:12,659 --> 00:01:16,879
the only peace is found in letting go.

5
00:01:19,439 --> 00:01:24,209
The days are travelers that will not stay.

6
00:01:26,389 --> 00:01:31,459
And happiness is walking a different way.

7
00:01:32,499 --> 00:01:37,709
There is no home awaiting after death,

8
00:01:39,369 --> 00:01:44,489
except the one you built with living breath.

9
00:01:45,959 --> 00:01:51,289
If built with good, a palace you shall find.

10
00:01:52,659 --> 00:01:57,809
If built with sin, you leave all hope behind.

11
00:02:03,819 --> 00:02:10,319
So work for the home where angels guard the gate.

12
00:02:10,819 --> 00:02:16,619
Where the prophet is the neighbor and the rewards are great.

13
00:02:17,769 --> 00:02:23,909
The walls are made of gold, the mortar smells of musk.

14
00:02:24,679 --> 00:02:28,849
A life that never fades into the dusk.

15
00:02:49,439 --> 00:02:54,779
Where are the kings, where is their royal throne?

16
00:02:56,089 --> 00:03:00,819
Where is the glory that the past has known?

17
00:03:03,349 --> 00:03:08,899
How many cities rose beneath the skies,

18
00:03:09,929 --> 00:03:15,009
only to crumble, wither and die?

19
00:03:16,459 --> 00:03:21,069
The cupbearer of death came to their halt,

20
00:03:22,469 --> 00:03:28,689
and poured the wine that ends it for us all.

21
00:03:28,689 --> 00:03:34,519
And now the sands have covered every storm.

22
00:03:36,049 --> 00:03:40,799
The high and low are buried and alone.

23
00:03:42,509 --> 00:03:48,399
Do not trust time, the seconds cut like knives.

24
00:03:50,479 --> 00:03:54,929
A single blink can swallow up our lives.

25
00:04:04,509 --> 00:04:08,589
True nobility is not in gold or birth,

26
00:04:11,109 --> 00:04:15,199
but in the faith you carry on this earth.

27
00:04:17,869 --> 00:04:23,439
Generosity comes first, patience is the key.

28
00:04:24,549 --> 00:04:28,759
A single prayer can set the spirit free.

29
00:04:58,899 --> 00:05:04,999
So work for the home where angels guard the gate.

30
00:05:05,429 --> 00:05:11,179
Where the prophet is the neighbor and the rewards are great.

31
00:05:12,479 --> 00:05:18,509
Its rivers flow with honey and with wine,

32
00:05:19,269 --> 00:05:23,809
for those who seek the mercy of the divine.

33
00:05:26,989 --> 00:05:32,239
This is the garden, eternal and green.

34
00:05:33,489 --> 00:05:37,739
The greatest sight the eyes have ever seen.

35
00:05:40,789 --> 00:05:45,999
And yet my soul will struggle to the end.

36
00:06:04,919 --> 00:06:10,879
I only find the path when I refuse to be my passion's friend.`;

  const parsedSubtitles = parseSRT(srtContent);

  // Mock prompts with timestamps
  const prompts: ImagePrompt[] = [
    {
      id: 'prompt-test-0',
      text: 'A melancholic scene representing the intro of the song',
      mood: 'Intro - Melancholic',
      timestamp: '00:00',
      timestampSeconds: 0
    },
    {
      id: 'prompt-test-1', 
      text: 'A somber scene representing verse 1 of the song',
      mood: 'Verse 1 - Somber',
      timestamp: '00:51',
      timestampSeconds: 51
    },
    {
      id: 'prompt-test-2',
      text: 'A contemplative scene representing verse 2 of the song', 
      mood: 'Verse 2 - Contemplative',
      timestamp: '01:59',
      timestampSeconds: 119
    },
    {
      id: 'prompt-test-3',
      text: 'An urgent caution scene representing bridge 1 of the song',
      mood: 'Bridge 1 - Urgent Caution', 
      timestamp: '03:03',
      timestampSeconds: 183
    },
    {
      id: 'prompt-test-4',
      text: 'A serene wonder scene representing the chorus/outro of the song',
      mood: 'Chorus_Outro 1 - Serene Wonder',
      timestamp: '03:23', 
      timestampSeconds: 203
    },
    {
      id: 'prompt-test-5',
      text: 'An ethereal lament scene representing the interlude of the song',
      mood: 'Interlude - Ethereal Lament',
      timestamp: '03:49',
      timestampSeconds: 229
    }
  ];

  // Mock generated images (placeholder data URLs)
  const generatedImages: GeneratedImage[] = prompts.map(prompt => ({
    promptId: prompt.id,
    imageUrl: `data:image/svg+xml;base64,${btoa(`
      <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#22d3ee" font-family="Arial" font-size="14" font-weight="bold">
          ${prompt.mood}
        </text>
        <text x="50%" y="70%" text-anchor="middle" dy=".3em" fill="#94a3b8" font-family="Arial" font-size="10">
          ${prompt.timestamp}
        </text>
      </svg>
    `)}`
  }));

  console.log(`✨ Created ${prompts.length} test prompts with placeholder images`);

  return {
    fileName: 'the true Saba.mp3',
    audioUrl: 'data:audio/mp3;base64,', // Placeholder - no actual audio in browser test
    srtContent,
    parsedSubtitles,
    prompts,
    generatedImages
  };
};