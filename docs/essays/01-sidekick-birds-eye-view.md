---
title: Project Sidekick - A Bird's Eye View
version: 1.0.0
audience: General
status: active
tags: [essays, sidekick]
deck: An introduction to Project Sidekick. What it is? What problem does it solve? Why am I building it?
created: 2026-07-19
updated: 2026-07-19
---

I am working on Project Sidekick to solve the challenges of my current digital setup and workflows. My goal is to build an ERP that runs my life. The motivation here is not the monetization or the mass appeal. Instead, the motivation is purely personal and utilitarian. I covered the journey – and my past failures – in my confessional essay: **[Building in Margins of Reality](../00-margins)**.

> In one sentence, Sidekick is an AI-powered Personal Operating System carefully calibrated to my lifestyle and workflows to help me become a better version of myself.

I know, I know – this corporate mumbo-jumbo doesn’t clarify a thing. If anything, it raises more questions than it answers. So let me break apart this definition and explain each piece in layman’s terms.

## What’s a Personal Operating System?

**Personal Operating System (POS)** is just a fancy name for a personalized productivity application to manage and run a person’s daily routines. Like the kernel of an operating system, everything that POS does is defined by a set of rules and values you set to match your habits and priorities. This isn’t new; it’s a digitized version of the frameworks influential figures have been using since at least 500 BC – from the Stoic discipline of Marcus Aurelius’ _Meditations_ and the pragmatic strategy of Machiavelli’s _The Prince_ to the foundational wisdom of _Chanakyaniti_ and _Arthashastra_.

## Do I have to use AI powers?

Suddenly everything is AI-powered these days, isn’t it? I mean, how crazy or unheard of would it be to build an app in 2026 and _not_ top it off with AI-sauce? Like Frank’s RedHot sauce, _we put that s\#\!t on everything_\! And if you were to believe my words, there are a couple of scenarios where the power of AI will truly shine through in Sidekick. For that, I will have to explain the last part of the cursed definition: **_become a better version of myself_**.

## What do I mean by “_become a better version of myself”_?

The whole idea of the Personal Operating System is to be self-aware, be present in the moment and take deliberate decisions. In practice, it means I plan my day to align with current circumstances, priorities and value system. It means that I resist impulsive actions and reflect on my values first. It means that my words and my actions align, establishing trust and preventing hypocrisy. On rare occasions where I have to take action that does not align with my value system because of unforeseen events, I will carefully identify the right course of action that aligns with my value system. I will treat this instance as a data point to refine my value system. This creates a feedback loop: my value system and my daily life evolve together, constantly refining my character.

That’s the last piece that would have thrown you off. Hopefully, now you've got a general idea of what Project Sidekick is.

Having a general understanding of what Personal Operating Systems are, now let’s talk about specific features of Project Sidekick: what exact problem I hope to solve by using it.

---

## The why parts

### To be more focused and present in the moment

Chaos and distractions of daily life often pull me away from my own priorities and principles. I find myself acting impulsively or sweating the small stuff while more important matters remain neglected. To fix this behavior, Sidekick will have the **War Room** for planning and strategy and the **Factory** for execution and automation.

### To forget less and apply what I learned in my daily life

I am a fan of [Charlie Munger’s multidisciplinary approach](https://www.playforthoughts.com/blog/charlie-munger-improve-live-by-multidisciplinary-approach) and [mental models](https://fs.blog/mental-models/). I read a lot on various subjects, take notes and hope to use what I learned in my life. Anytime I encounter an interesting fact while learning, I pause and ponder: How can I use what I just learned about nature and reality into my own life?

Reading for curiosity is one thing; but reading for lifelong retention needs a sound strategy. I’ve realized that relying on my memory to synthesize these principles is a fool's errand.

Our brains are designed to remember what’s immediately relevant, not to archive abstract concepts for a future where they might be useful. Consequently, fringe concepts—like entropy—are quickly forgotten, reduced to mere cocktail-party trivia rather than living tools for decision-making.

To fix this problem and remember more, I am building **Taxila** – a Sidekick module for knowledge management. Slowly but gradually, I will upload all my notes in the smallest units possible and enrich them with metadata like related concepts, subjects, and industry. These notes are then transformed into embeddings for an RAG (Retrieval-Augmented Generation) agent. With this setup, Project Sidekick doesn’t just store information; it actively surfaces my learned concepts whenever they are relevant to my current reality.

### What would an ideal version of myself do?

**Alter Ego** is an AI chatbot built on my own data—my plans, principles, and priorities. Armed with my plans, priorities, principles, and knowledgebase, I could confide in this agent during the moment of doubt or confusion and trust it with my private affairs – effectively talking to a version of myself who knows more and sees things clearly. This will help me clear brain fog, see things for what they are and make better judgement calls.

### Do more with less friction

I want to reduce the friction of using my apps. We live on our mobile devices, and yet typing on small, non-tactile screens remains a bottleneck. I want to use my voice more often without being reminded of my Indian accent. Where native dictation services consistently struggle to understand me, the premium alternatives demand $100+/year in subscription fees. Not liking my options, I am building **Parrot**: a voice dictation service with gesture support for punctuation and formatting.

While Parrot handles the input, the **Factory** handles the execution. It will be an execution powerhouse for automations and push-button workflows:

1. **Routine tasks**: I can set up push-button workflows for frequent tasks. For instance, clicking a “School+Car” icon in the toolbar adds a task for the next day to pick up the children without typing a word.
2. **Inbox management**: Automated replies to emails and messages, decluttering my inbox, and surfacing only the messages that require manual decisions.
3. **IoT integration**: IoT automations, like closing the blinds when lights turn on for privacy, or closing the garage door automatically when I drive away.

For the most part, both Parrot and Factory are out of scope for MVP. What’s in scope is push-button workflows (\# 1 above) and ability to configure input defaults or to configure forms to open with previously typed inputs.

### Get better at writing

I am getting ready for my second career in writing and academia. At least half of this job will depend on my ability to clearly articulate ideas and influence readers to care about the same things as I do. Historically, written words have carried the most weight in these fields, and to succeed, I must master the craft.

To help me, I am building **Zinsser**. Named after a master teacher and renowned writer, Zinsser will be an AI-powered writing app trained on my own writing styles, rules and vocabulary. It won’t just be a bot that churns out “release-ready” copies that sounds like me; it will also be my writing coach. As I feed more drafts, it will guide me point-by-point, learning my patterns and drawing my attention to the mistakes I repeat. My goal isn't just to generate text—it’s to internalize those lessons so that, over time, I need less guidance and fewer corrections.

### Build minions (not in MVP-scope)

As you’ll learn later in Architectural Overview, Sidekick’s architecture is quite extensible. I can add any capability I want easily as and when I need it. This will eventually let me consolidate the various SaaS services I rely on today—like cloud storage and parental controls. Rather than paying for multiple subscriptions, I can simply build what I need and deploy it with the help of AI in an evening. It’s a "build vs. buy" mindset, executed at scale.

---

## Global themes and finepoints

### Core Drive

**Core Drive** isn’t a visible feature of the application that I can interact with. It is going to be the mind that influences how everything else will behave in Sidekick. The entire point of building Sidekick is for me to be more in sync with my values and help me grow as I learn more.

These objectives cannot be achieved unless there is a _core_ that knows me completely – that’s the Core Drive’s job. The Core Drive will learn and evolve continuously as you use the application more and more, becoming the best _Sidekick_ you ever had.

### Power of synergies

New possibilities emerge when you combine and use individual features in novel ways. Likes of Apple and Google already allow their users to reference an element from an app (say Notes) to another app (say, Messages).

I plan to make this possible in Sidekick with the power of graph stores. While individual feature data will stay in their own dedicated data store, the relationship between these elements will be stored in a global graph store. To complement the relationship between two entities, we will also have a global metadata service that will allow me to add metadata to different entities of the app. For example, I can add tags to either a learning notes, tasks or the workflow object that I just created.

### Rethinking AI interactions and discoverability

Sidekick will also be a platform for me to experiment with few usability patterns when it comes to interacting with AI. One of the biggest bummers I see with AI is that for all its might we’re still stuck with chat interface. We still haven’t found a way to think outside the (chat)box. As I build AI-powered features, I intend to do some experimentation with non-chat interaction patterns.

On the flip side, I can’t get past decision fatigue while designing in spite of being very fond of the design process. I can’t decide between endless choices of fonts, colors, and so on. It’s always the one that got away (did not choose) that makes me rethink later, no matter how good my initial choice. In the end, I end up spending hours with nothing to show for in the end.

To overcome this shortcoming, I am going to cheat by riding on the current wave of CLI-based interfaces. For an MVP with an audience of one user, I don’t have to have a site layout, navigation, logo etc. Just one search box in the center of a page like Google should do. It will allow the user to type the command they want to give or the page they want to open (think Cmd+P in VS Code or / in Notion).

This makes the MVP of the Sidekick keyboard heavy. And if you don’t know what you’re looking for, the system will not help you find it. That’s a fair limitation I am willing to work with for an audience of one.

---

## Where do the things stand today?

- Phase 0 \- Done \- Foundation and tooling
- Phase 1 \- Done \- Supabase and Auth setup
- Phase 1.1 \- Done (Improvisation of Phase 1 to make bypassing of conventions harder)
- Phase 2 \- API Guards and Feature Gate System \[Next\]

---

## Personal motivations

Other than my itch to build something based on my own vision, my personal motivation behind Projects are:

1. Build a social profile, establish professional reputation in the tech industry, share content and teach others.

2. Learn full stack application development with the help of Agent. I am not going to vibecode Sidekick – that’s not fulfilling to me. I am going to ask Claude to give the instructions to write the code to me and teach me along the way. You’ll have access to the same instructions to follow along with me in the “Builds” section of this site.

3. Use the tools and technologies I don’t get to use at work, such as Supabase, Turborepo, pnpm, setting up build and deployment pipelines, Next.js, Drizzle, PostgresSQL, oAuth, etc.

---

## An honest assessment of marketability

Marketability of an AI-based solution that fills the gap between who you’re and who you want to be isn’t looking that great to me. Though not based on any science or research, it is my belief that less than 5% of the original population who began with a resolution or a goal stick to it by the end of the 24 month period, 75 percent of them giving up by the 12 month mark. You must think that I have a pretty dark view of human potential. It’s better dark than being the one with their head in the clouds.

You might counter my argument by saying that with AI things will be different. With AI as our companion, we will get better by sticking to our plans and resolutions. I don’t think that’s possible. Because AI can fix the problem of knowledge, forgetting or unawareness; not of execution.

With or without AI, you are still going to need the same old fashioned drudgery and hustle to stick to the goal when things get tough. To fix our deficiencies of motivation, willpower or procrastination, we must wait for a breakthrough in medical science (specifically, biotech) where we can medically or surgically edit certain traits. If and when that happens, are we even human anymore if we all possess similar traits within the spectrum of what society calls _normal_ or _acceptable_?

_July 18, 2026 — West Windsor, NJ_

## Reading materials

To learn about the framework to run your life and learn from the people who successfully executed it, here are some sources where you might find inspirations:

- [The Knowledge Project Podcast](https://www.youtube.com/@tkppodcast/videos)
- [Farnam Street Blog](https://fs.blog)
- Poor Charlie’s Almanack > [eBook (free)](https://www.stripe.press/poor-charlies-almanack/cover) > [Paper](https://www.goodreads.com/book/show/944652.Poor_Charlie_s_Almanack?ac=1&from_search=true&qid=6WirN5iUDw&rank=1)
- Naval Ravikant’s Almanack > [eBook (free)](https://www.navalmanack.com/) > [Paper](https://www.goodreads.com/book/show/54898389-the-almanack-of-naval-ravikant?from_search=true&from_srp=true&qid=O68wqNVIwB&rank=1)
- Principles by Ray Dalio > [Online](https://www.principles.com/) > [Paper](https://www.goodreads.com/book/show/34536488-principles?from_search=true&from_srp=true&qid=j4dEbpeTYm&rank=1)
- 12 Rules for Life > [Paper](https://www.goodreads.com/book/show/30257963-12-rules-for-life?ref=nav_sb_ss_1_8)

Learn how a gap between what you do and what you believe can lead to feeling of guilt and regret:

- [What Is Cognitive Dissonance?](https://www.verywellmind.com/what-is-cognitive-dissonance-2795012)
- [Why is it so hard to change someone's beliefs?](https://thedecisionlab.com/biases/cognitive-dissonance?adw=true&utm_campaign=21+Biases+-+Cognitive+Dissonance&utm_medium=ppc&utm_source=adwords&utm_term=leon%20festinger&hsa_mt=b&hsa_net=adwords&hsa_ad=500704987098&hsa_src=g&hsa_cam=12416038273&hsa_kw=leon%20festinger&hsa_grp=119028028715&hsa_tgt=kwd-95192063&hsa_ver=3&hsa_acc=8441935193&gad_source=1&gad_campaignid=12416038273&gbraid=0AAAAADQTTnsYTdfag4164RmdA6C8OW0rl&gclid=CjwKCAjwyOzSBhBTEiwAmxvJ-khrv2jYaM5bKTFhM4DqADOpavUNyoFRwMuGJY19geoqCWAqPwz_5hoCYhIQAvD_BwE)
