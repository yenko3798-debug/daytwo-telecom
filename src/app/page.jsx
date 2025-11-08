'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Container } from '@/components/Container'
import {
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
} from '@/components/SocialIcons'

/* ---------- data ---------- */

const projects = [
  {
    id: '8mile',
    name: '8 Mile',
    href: 'https://www.roblox.com/games/121787249923114/UPD-8-Mile',
    role: 'Narrative & gameplay systems',
    visits: '544K+ visits.',
    description:
      'Built gameplay systems that tie combat, story beats, and progression into a cohesive, replayable experience.',
    focus: [
      'Progression pacing & unlocks',
      'Narrative integration with gameplay',
      'Replayable encounter structure',
    ],
    primaryVideo: 'https://www.youtube.com/embed/SYoA875G9pw',
  },
  {
    id: 'arcadia',
    name: 'Arcadia RPG',
    href: 'https://www.roblox.com/games/70679403248874/Arcadia',
    role: 'Open-world RPG • systems & world feel',
    visits: 'Dynamic weather, movement & job systems.',
    description:
      'Designed and scripted the core experience: responsive movement, atmospheric world behavior, and an extensible job system.',
    focus: [
      'Dynamic weather & world states',
      'Advanced movement & camera feel',
      'Job system with scalable economy',
    ],
  },
  {
    id: 'booga',
    name: 'Booga Booga Reborn',
    href: '#',
    role: 'Systems & combat programmer',
    visits: 'Contributed to 100M+ total visits across versions.',
    description:
      'Worked on combat flow, progression systems, and polish for a massive survival experience with a dedicated community.',
    focus: [
      'Combat tuning & feel',
      'Meta progression systems',
      'Live-ops friendly architecture',
    ],
  },
  {
    id: 'fairy-tail',
    name: 'Fairy Tail: Magic Brawl',
    href: '#',
    role: 'Abilities, effects & feel',
    visits: 'Anime-inspired competitive brawler.',
    description:
      'Focused on ability scripting, hit feedback, and VFX timing to make every cast feel impactful and readable in fast-paced matches.',
    focus: [
      'Ability kit scripting',
      'Hitstop, VFX and SFX timing',
      'Readability in chaotic arenas',
    ],
  },
]

/* ---------- animation helpers ---------- */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: 0.1 * i,
      ease: [0.22, 0.61, 0.36, 1],
    },
  }),
}

function SocialLink({ icon: Icon, ...props }) {
  return (
    <Link className="group -m-1 p-1" {...props}>
      <Icon className="h-6 w-6 fill-zinc-500 transition group-hover:fill-emerald-400 dark:fill-zinc-400 dark:group-hover:fill-emerald-300" />
    </Link>
  )
}

/* ---------- hero stats / rail ---------- */

function StatsBar() {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className="mt-8 inline-flex w-full flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/25 bg-slate-950/70 px-4 py-3 text-xs text-slate-200 shadow-lg shadow-emerald-500/10 backdrop-blur-sm dark:bg-black/70"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2 items-center justify-center">
          <span className="absolute h-3 w-3 rounded-full bg-emerald-400/40 blur-[2px]" />
          <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="font-medium">100M+ visits</span>
        <span className="text-slate-400">across Roblox projects</span>
      </div>
      <span className="h-px flex-1 bg-gradient-to-r from-slate-700 via-slate-600/40 to-transparent" />
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-300">
          @Foe
        </span>
        <span className="text-[0.75rem] text-slate-400">
          My roblox username if you'd like to follow up for any future projects
        </span>
      </div>
    </motion.div>
  )
}

function CutsceneRail({ onPlayCutscene }) {
  const clips = [
    {
      label: '8 Mile • Arrival',
      tag: 'Cinematic street intro',
    },
    {
      label: '8 Mile • Systems flythrough',
      tag: 'Movement, weather, progression',
    },
    {
      label: '8 Mile • Job flow',
      tag: 'Diegetic progression UI',
    },
  ]

  return (
    <motion.div
      variants={fadeUp}
      custom={1}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className="mt-12"
    >
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-5 py-4 shadow-xl shadow-emerald-500/15">
        {/* soft glows */}
        <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Site cutscene
            </p>
            <p className="mt-1 text-sm text-slate-200">
              A stylized in-browser cutscene inspired by 8 Mile’s atmosphere and
              systems.
            </p>
            <button
              type="button"
              onClick={onPlayCutscene}
              className="mt-3 inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/20 hover:border-emerald-300"
            >
              Play animated cutscene
            </button>
          </div>


        </div>
      </div>
    </motion.div>
  )
}

/* ---------- shimmer skeleton ---------- */

function ShimmerBox({ className = '' }) {
  return <div className={`shimmer relative overflow-hidden rounded-xl ${className}`} />
}

/* ---------- projects & reel ---------- */

function Project({ project, onOpen }) {
  return (
    <motion.article
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70 p-5 shadow-md shadow-black/40 transition-transform duration-300 hover:-translate-y-1 hover:border-emerald-400/70 hover:shadow-emerald-500/25"
    >
      <Card.Title href={project.href}>
        <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
          {project.name}
        </span>
      </Card.Title>
      <Card.Eyebrow as="p" decorate>
        {project.role}
      </Card.Eyebrow>
      <Card.Description>{project.description}</Card.Description>
      {project.visits && (
        <p className="mt-2 text-xs font-medium text-slate-400">
          {project.visits}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="secondary" href={project.href} className="text-xs">
          View on Roblox
        </Button>
        <button
          type="button"
          onClick={() => onOpen(project)}
          className="text-xs font-medium text-emerald-400 underline-offset-4 hover:underline"
        >
          View systems breakdown
        </button>
      </div>

      {/* subtle bottom glow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 translate-y-10 bg-gradient-to-t from-emerald-400/20 via-transparent to-transparent opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100" />
    </motion.article>
  )
}

function Reel() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 900)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-lg shadow-black/40"
    >
      <h2 className="text-sm font-semibold text-slate-100">
        8 Mile systems & gameplay reel
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Short looks at the 8 Mile systems: responsive motion, weather, and
        progression that ties into the street narrative.
      </p>

      <div className="mt-4 space-y-4">
        {/* 8 Mile general gameplay (YouTube) */}
        <div className="group relative overflow-hidden rounded-xl bg-black/60 ring-1 ring-slate-800 transition hover:ring-emerald-400/70">
          <div className="aspect-[16/9]">
            {!loaded && <ShimmerBox className="h-full w-full" />}
            {loaded && (
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/SYoA875G9pw"
                title="8 Mile Gameplay"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-[0.7rem] text-slate-400">
            <span>8 Mile • general gameplay</span>
            <span className="uppercase tracking-wide text-emerald-300">
              Feature reel
            </span>
          </div>
        </div>

        {/* 8 Mile – weather & movement */}
        <div className="group relative overflow-hidden rounded-xl bg-black/60 ring-1 ring-slate-800 transition hover:ring-emerald-400/70">
          <div className="aspect-[16/9]">
            {!loaded && <ShimmerBox className="h-full w-full" />}
            {loaded && (
              <iframe
                className="h-full w-full"
                src="https://streamable.com/e/8jvmn9"
                title="8 Mile weather & movement system"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-[0.7rem] text-slate-400">
            <span>8 Mile • weather & movement system</span>
            <span className="uppercase tracking-wide text-slate-500">
              World feel
            </span>
          </div>
        </div>

        {/* 8 Mile – job system */}
        <div className="group relative overflow-hidden rounded-xl bg-black/60 ring-1 ring-slate-800 transition hover:ring-emerald-400/70">
          <div className="aspect-[16/9]">
            {!loaded && <ShimmerBox className="h-full w-full" />}
            {loaded && (
              <iframe
                className="h-full w-full"
                src="https://streamable.com/e/2cl8p6"
                title="8 Mile job system"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-[0.7rem] text-slate-400">
            <span>8 Mile • job system</span>
            <span className="uppercase tracking-wide text-slate-500">
              Progression & economy
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ---------- animated “site cutscene” overlay ---------- */

function SiteCutscene({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-4xl rounded-3xl border border-slate-800/80 bg-slate-950/95 p-6 shadow-2xl shadow-black/60"
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full bg-slate-900/80 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>

            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Animated cutscene
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">
              8 Mile-inspired systems flythrough
            </h2>
            <p className="text-xs text-slate-400">
              Not game footage – a custom web cutscene that mirrors how I think
              about motion, atmosphere, and systems.
            </p>

            <div className="mt-4">
              <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
                {/* sky */}
                <motion.div
                  className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-sky-500/40 via-slate-900 to-slate-950"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.2 }}
                />
                {/* sun */}
                <motion.div
                  className="absolute -top-10 left-10 h-32 w-32 rounded-full bg-amber-300/80 blur-md"
                  initial={{ x: -120, y: -40, opacity: 0 }}
                  animate={{ x: [ -120, 40, 140 ], y: [ -40, -60, -40 ], opacity: [0, 1, 1] }}
                  transition={{ duration: 7, ease: 'easeInOut' }}
                />
                {/* far buildings */}
                <motion.div
                  className="absolute bottom-24 left-0 right-0 flex justify-between px-8 text-slate-800"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                >
                  {[1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      className="h-24 w-12 rounded-t-md bg-slate-800/70"
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        delay: i * 0.3,
                        duration: 4,
                        repeat: Infinity,
                        repeatType: 'reverse',
                      }}
                    />
                  ))}
                </motion.div>
                {/* street band */}
                <motion.div
                  className="absolute inset-x-0 bottom-16 h-16 bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/90"
                  initial={{ y: 32, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.7 }}
                />
                {/* moving buildings in foreground */}
                <motion.div
                  className="absolute inset-x-0 bottom-16 flex gap-6 px-10"
                  initial={{ x: '10%' }}
                  animate={{ x: ['10%', '-10%', '0%'] }}
                  transition={{ duration: 10, ease: 'easeInOut' }}
                >
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 flex-1 rounded-lg bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 shadow-lg shadow-black/40"
                    >
                      <div className="flex h-full items-end justify-between px-3 pb-2 text-[0.6rem] text-slate-300">
                        <span>Block {i}</span>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
                          live
                        </span>
                      </div>
                    </div>
                  ))}
                </motion.div>
                {/* character card */}
                <motion.div
                  className="absolute bottom-24 left-6 w-40 rounded-xl border border-emerald-400/40 bg-slate-950/90 p-3 text-xs text-slate-200 shadow-lg shadow-emerald-500/30"
                  initial={{ x: -120, opacity: 0 }}
                  animate={{
                    x: [ -120, 20, 220, 220 ],
                    opacity: [0, 1, 1, 0.4],
                  }}
                  transition={{ duration: 7, ease: 'easeInOut', delay: 1.1 }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold">Player: @Foe</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-[0.65rem] text-slate-400">
                    Movement, weather and jobs syncing in real time.
                  </p>
                </motion.div>
                {/* systems HUD */}
                <motion.div
                  className="absolute top-6 right-6 w-56 rounded-xl border border-slate-700/70 bg-slate-950/90 p-3 text-[0.65rem] text-slate-300"
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3, duration: 0.6 }}
                >
                  <div className="mb-1 flex items-center justify-between text-[0.7rem]">
                    <span className="font-semibold text-slate-100">
                      Systems monitor
                    </span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
                      synced
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Weather</span>
                      <span className="text-emerald-300">dynamic</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Movement</span>
                      <span>server-authoritative</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Jobs</span>
                      <span>queued & balanced</span>
                    </div>
                  </div>
                </motion.div>
                {/* timeline bar */}
                <motion.div
                  className="absolute inset-x-10 bottom-4 h-1 rounded-full bg-slate-800/80"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                >
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-300"
                    initial={{ width: '0%' }}
                    animate={{ width: ['0%', '100%'] }}
                    transition={{ duration: 8, ease: 'easeInOut', delay: 1.3 }}
                  />
                </motion.div>
                {/* black letterbox bars for cinematic feel */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black via-black/80 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black via-black/80 to-transparent" />

                <div className="relative aspect-[16/9]" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------- systems modal for each project ---------- */

function ProjectModal({ project, open, onClose }) {
  return (
    <AnimatePresence>
      {open && project && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-3xl rounded-3xl border border-slate-800/80 bg-slate-950/95 p-6 shadow-2xl shadow-black/60"
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full bg-slate-900/80 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>

            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Systems breakdown
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">
              {project.name}
            </h2>
            <p className="text-xs text-slate-400">{project.role}</p>

            <div className="mt-4 grid gap-4 md:grid-cols-[3fr,2fr]">
              <div className="space-y-3">
                {project.primaryVideo && (
                  <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-black/70">
                    <div className="aspect-[16/9]">
                      <iframe
                        className="h-full w-full"
                        src={project.primaryVideo}
                        title={`${project.name} systems reel`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
                <p className="text-sm text-slate-300">{project.description}</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-3 text-xs text-slate-200">
                  <p className="mb-1 font-semibold text-emerald-300">
                    Focus areas
                  </p>
                  <ul className="space-y-1">
                    {project.focus?.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3 text-xs text-slate-300">
                  <p className="mb-1 font-semibold text-slate-100">
                    How I’d extend it
                  </p>
                  <p>
                    I design systems with live-ops and updates in mind:
                    stateless modules where possible, clear configuration layers,
                    and tooling for quickly testing balance changes without
                    breaking live servers.
                  </p>
                </div>

                <Button
                  variant="primary"
                  href={project.href}
                  className="w-full justify-center text-sm"
                >
                  Open {project.name} on Roblox
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------- experience & contact ---------- */

function Resume() {
  const resume = [
    {
      company: '8 Mile',
      title: 'Gameplay & progression programmer • 544K+ visits',
      start: '2024',
      end: {
        label: 'Present',
        dateTime: new Date().getFullYear().toString(),
      },
    },
    {
      company: 'Arcadia RPG',
      title: 'Systems & world feel',
      start: '2024',
      end: {
        label: 'Present',
        dateTime: new Date().getFullYear().toString(),
      },
    },
    {
      company: 'Booga Booga Reborn',
      title: 'Systems & combat programmer • 100M+ visits across versions',
      start: '2022',
      end: '2024',
    },
    {
      company: 'Fairy Tail: Magic Brawl',
      title: 'Combat / abilities & VFX scripting',
      start: '2023',
      end: '2024',
    },
  ]

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-lg shadow-black/40"
    >
      <h2 className="flex text-sm font-semibold text-slate-100">
        Roblox experience
      </h2>
      <ol className="mt-6 space-y-4">
        {resume.map((role, index) => (
          <li key={index} className="flex gap-4">
            <div className="relative mt-1 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-emerald-400 to-cyan-400 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-950 shadow-md shadow-emerald-500/40">
              {role.company[0]}
            </div>
            <dl className="flex flex-auto flex-wrap gap-x-2">
              <dt className="sr-only">Project</dt>
              <dd className="w-full flex-none text-sm font-medium text-slate-100">
                {role.company}
              </dd>
              <dt className="sr-only">Role</dt>
              <dd className="text-xs text-slate-400">{role.title}</dd>
              <dt className="sr-only">Date</dt>
              <dd className="ml-auto text-xs text-slate-500">
                <time dateTime={role.start}>{role.start}</time>{' '}
                <span aria-hidden="true">—</span>{' '}
                <time
                  dateTime={
                    typeof role.end === 'string'
                      ? role.end
                      : role.end.dateTime
                  }
                >
                  {typeof role.end === 'string' ? role.end : role.end.label}
                </time>
              </dd>
            </dl>
          </li>
        ))}
      </ol>
    </motion.div>
  )
}

function ContactCard() {
  return (
    <motion.div
      variants={fadeUp}
      custom={2}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-lg shadow-black/40"
    >
      <h2 className="text-sm font-semibold text-slate-100">
        Commission & collaboration
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Looking for a systems-level Roblox dev for your next title? Send a short
        brief and I’ll reply with scope, questions, and possible directions.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          variant="primary"
          href="mailto:hello@example.com?subject=Roblox%20project%20inquiry"
        >
          Email a brief
        </Button>
        <Button
          variant="secondary"
          href="https://instagram.com/n2"
          className="text-sm"
        >
          DM @n2 on Instagram
        </Button>
      </div>
    </motion.div>
  )
}

/* ---------- main page ---------- */

export default function Home() {
  const [modalProject, setModalProject] = useState(null)
  const [cutsceneOpen, setCutsceneOpen] = useState(false)

  return (
    <>
      <Container className="mt-12">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-3 rounded-full border border-slate-800/70 bg-slate-950/80 px-4 py-1.5 text-xs font-medium text-slate-200 shadow-lg shadow-black/40 backdrop-blur-sm">
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-100">
              Yenko
            </span>
            <span>@Foe on Roblox</span>
            <span className="h-1 w-1 rounded-full bg-slate-600" />
            <span>@n2 on Instagram</span>
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
            <span className="bg-gradient-to-br from-emerald-300 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
              Roblox scripter & systems designer
            </span>{' '}
            building games players actually stay in.
          </h1>

          <p className="mt-6 text-base text-slate-300">
            I’m <span className="font-semibold text-slate-50">Yenko</span>, also
            known as <span className="font-mono text-sm">@Foe</span> on Roblox.
            I’ve contributed to{' '}
            <span className="font-semibold">100M+ visits</span> across titles
            like Booga Booga Reborn, Fairy Tail: Magic Brawl,{' '}
            <span className="font-semibold">Arcadia RPG</span>, and{' '}
            <span className="font-semibold">8 Mile</span>. I focus on movement,
            world systems, and progression that feel premium, replayable, and
            built for long-term brands.
          </p>

          <StatsBar />
          <CutsceneRail onPlayCutscene={() => setCutsceneOpen(true)} />

          <div className="mt-8 flex flex-wrap gap-4">
            <Button href="#projects">View my work</Button>
            <Button
              href="https://instagram.com/n2"
              variant="secondary"
              className="sm:inline-flex"
            >
              DM me on Instagram
            </Button>
          </div>

          <div className="mt-6 flex gap-6">
            <SocialLink
              href="https://www.roblox.com/users/profile?username=Foe"
              aria-label="Roblox profile"
              icon={XIcon}
            />
            <SocialLink
              href="https://instagram.com/n2"
              aria-label="Instagram profile"
              icon={InstagramIcon}
            />
            <SocialLink href="#" aria-label="GitHub profile" icon={GitHubIcon} />
            <SocialLink
              href="#"
              aria-label="LinkedIn profile"
              icon={LinkedInIcon}
            />
          </div>
        </motion.div>
      </Container>

      {/* Projects + reel + experience */}
      <Container id="projects" className="mt-24 md:mt-28">
        <div className="mx-auto grid max-w-xl grid-cols-1 gap-y-16 lg:max-w-none lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-x-16">
          <div className="flex flex-col gap-8">
            {projects.map((project) => (
              <Project
                key={project.id}
                project={project}
                onOpen={setModalProject}
              />
            ))}
          </div>

          <div className="space-y-8">
            <Reel />
            <Resume />
            <ContactCard />
          </div>
        </div>
      </Container>

      <SiteCutscene open={cutsceneOpen} onClose={() => setCutsceneOpen(false)} />
      <ProjectModal
        project={modalProject}
        open={Boolean(modalProject)}
        onClose={() => setModalProject(null)}
      />
    </>
  )
}
  