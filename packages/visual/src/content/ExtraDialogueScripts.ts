import type { DialogueTree } from '../types';

export const EXTRA_DIALOGUE_SCRIPTS: Record<string, DialogueTree> = {
  birth_house_bed: {
    id: 'birth_house_bed',
    firstNode: 'start',
    nodes: {
      start: {
        id: 'start',
        speaker: '帷幔木榻',
        portraitKey: '',
        text: '木榻外垂着半卷旧帷幔，褥面铺得平整，枕边还压着一块折好的粗布。\n这不像谁私藏的卧房，更像给后来者共用的落脚处。',
        choices: [
          { text: '坐下歇一会', next: 'rest' },
          { text: '看看床头', next: 'bedside' },
          { text: '离开', next: 'leave' },
        ],
      },
      rest: {
        id: 'rest',
        speaker: '帷幔木榻',
        portraitKey: '',
        text: '你在床沿坐了片刻。\n帷幔轻轻晃动，屋梁与屏风把这一角围得很安稳。\n若有人长途跋涉初入此地，多半会先在这里缓过一口气。',
        next: 'leave',
      },
      bedside: {
        id: 'bedside',
        speaker: '帷幔木榻',
        portraitKey: '',
        text: '床头除了粗布，还放着一只小木箱。\n里面没有贵重东西，只有备用灯芯、针线和替换的纸签，像是专为轮流住进来的人备好的。',
        next: 'leave',
      },
      leave: {
        id: 'leave',
        speaker: '帷幔木榻',
        portraitKey: '',
        text: '你理了理帷幔，起身离开木榻。',
      },
    },
  },

  birth_house_bookshelf_found_manual: {
    id: 'birth_house_bookshelf_found_manual',
    firstNode: 'start',
    nodes: {
      start: {
        id: 'start',
        speaker: '藏卷书架',
        portraitKey: '',
        text: '你拨开一排旧卷，指尖忽然碰到一册薄薄的线装小书。\n封面上写着三个淡墨小字：《吐纳入门》。\n\n你获得了秘籍《吐纳入门》。',
      },
    },
  },

  birth_house_bookshelf_manual_repeat: {
    id: 'birth_house_bookshelf_manual_repeat',
    firstNode: 'start',
    nodes: {
      start: {
        id: 'start',
        speaker: '藏卷书架',
        portraitKey: '',
        text: '你又翻了翻书架。\n那本《吐纳入门》已经被你收好，剩下的多是前人留下的札记和观察笔记。',
      },
    },
  },

  birth_house_bookshelf: {
    id: 'birth_house_bookshelf',
    firstNode: 'start',
    nodes: {
      start: {
        id: 'start',
        speaker: '藏卷书架',
        portraitKey: '',
        text: '高木架分成三层，卷册、札记和散页分门别类塞得很满。\n书脊磨损不一，显然是许多观察者先后留下来的见闻。',
        choices: [
          { text: '翻看书册', next: 'read' },
          { text: '查看批注', next: 'notes' },
          { text: '离开', next: 'leave' },
        ],
      },
      read: {
        id: 'read',
        speaker: '藏卷书架',
        portraitKey: '',
        text: '你抽出一卷旧札，里面记的不是招式，而是“何时观望、何时试探、何时收手”的碎片心得。\n这些话像江湖口传心法，也像真正的策略残篇。',
        next: 'leave',
      },
      notes: {
        id: 'notes',
        speaker: '藏卷书架',
        portraitKey: '',
        text: '架角夹着一张细纸签，上面有一行淡墨：\n“先看懂人，再看懂势。”\n旁边还有另一句更轻的字：\n“势来之前，往往只听得见风声。”',
        next: 'leave',
      },
      leave: {
        id: 'leave',
        speaker: '藏卷书架',
        portraitKey: '',
        text: '你把卷册插回原位，木架轻轻晃了一下。',
      },
    },
  },

  birth_house_desk: {
    id: 'birth_house_desk',
    firstNode: 'start',
    nodes: {
      start: {
        id: 'start',
        speaker: '长案',
        portraitKey: '',
        text: '长案擦得很亮，案上压着一卷未写完的纸、几支狼毫和半盏凉茶。\n旁边的小凳略微后移，像是有人刚离开不久。',
        choices: [
          { text: '看看纸页', next: 'paper' },
          { text: '观察四周', next: 'observe' },
          { text: '离开', next: 'leave' },
        ],
      },
      paper: {
        id: 'paper',
        speaker: '长案',
        portraitKey: '',
        text: '纸页上只写着几行很短的话：\n“今日所见，不必急着下断言。”\n“先问一问，再决定是战是谈。”\n“灵感常常不是打出来的，而是听出来的。”',
        next: 'leave',
      },
      observe: {
        id: 'observe',
        speaker: '长案',
        portraitKey: '',
        text: '从长案望出去，能看见门边屋规、帷幔木榻和对面的藏卷架。\n这个角落像整间小屋的心脏：先记录、再思考，然后才决定往哪条路上走。',
        next: 'leave',
      },
      leave: {
        id: 'leave',
        speaker: '长案',
        portraitKey: '',
        text: '你收回视线，转身走开。',
      },
    },
  },

  birth_house_notice: {
    id: 'birth_house_notice',
    firstNode: 'start',
    nodes: {
      start: {
        id: 'start',
        speaker: '屋规告示',
        portraitKey: '',
        text: '门边立着一面双联告示牌，木框被摸得发亮，上面钉着几张新旧不一的纸签。',
        choices: [
          { text: '读一读', next: 'read' },
          { text: '离开', next: 'leave' },
        ],
      },
      read: {
        id: 'read',
        speaker: '屋规告示',
        portraitKey: '',
        text: '纸签上写着：\n“此屋为后来者歇脚之所。”\n“入世先观，见人先问。”\n“若要动手，也须先听完一句话。”',
        next: 'leave',
      },
      leave: {
        id: 'leave',
        speaker: '屋规告示',
        portraitKey: '',
        text: '你把纸签内容记在心里，转身望向门外。',
      },
    },
  },
};
