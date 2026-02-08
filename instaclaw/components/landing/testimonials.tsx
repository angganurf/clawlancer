const testimonials = {
  row1: [
    {
      quote:
        "I asked it to plan my entire vacation, book restaurants, and draft packing lists. It did all of it. I just sat there.",
      name: "Sarah M.",
      role: "Freelancer",
      initials: "SM",
    },
    {
      quote:
        "I don't know anything about tech. I told it what I needed in plain English and it just handled everything. Like magic.",
      name: "James K.",
      role: "Small Business Owner",
      initials: "JK",
    },
    {
      quote:
        "It remembered every single detail about 200+ clients and followed up with each one personally. I feel like I have superpowers.",
      name: "Priya R.",
      role: "Real Estate Agent",
      initials: "PR",
    },
    {
      quote:
        "I gave it one task as a test. An hour later it had done that plus five other things I didn't even think to ask for.",
      name: "Marcus T.",
      role: "Content Creator",
      initials: "MT",
    },
    {
      quote:
        "It wrote my cover letters, prepped me for interviews, and tracked every application. I literally got the job because of this.",
      name: "Ava L.",
      role: "College Student",
      initials: "AL",
    },
  ],
  row2: [
    {
      quote:
        "I went to sleep. Woke up to 30 emails answered, my calendar organized, and a summary waiting for me. It never stops working.",
      name: "Danny W.",
      role: "Startup Founder",
      initials: "DW",
    },
    {
      quote:
        "It's like having an entire team that works 24/7 and never complains. I just think of something and it's already doing it.",
      name: "Rachel S.",
      role: "Marketing Manager",
      initials: "RS",
    },
    {
      quote:
        "I asked it to research competitors, summarize the results, and draft a report. Done in 20 minutes. That used to take me days.",
      name: "Tom H.",
      role: "Teacher",
      initials: "TH",
    },
    {
      quote:
        "There is nothing I've thrown at it that it couldn't do. Emails, research, scheduling, writing. Literally anything.",
      name: "Nina P.",
      role: "Consultant",
      initials: "NP",
    },
    {
      quote:
        "My 68-year-old mom set it up by herself and now she won't stop telling her friends about it. That's all you need to know.",
      name: "Chris D.",
      role: "Product Designer",
      initials: "CD",
    },
  ],
};

const glassStyle = {
  background:
    "linear-gradient(-75deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05))",
  backdropFilter: "blur(2px)",
  WebkitBackdropFilter: "blur(2px)",
  boxShadow: `
    rgba(0, 0, 0, 0.05) 0px 2px 2px 0px inset,
    rgba(255, 255, 255, 0.5) 0px -2px 2px 0px inset,
    rgba(0, 0, 0, 0.1) 0px 2px 4px 0px,
    rgba(255, 255, 255, 0.2) 0px 0px 1.6px 4px inset
  `,
};

function TestimonialCard({
  quote,
  name,
  role,
  initials,
}: {
  quote: string;
  name: string;
  role: string;
  initials: string;
}) {
  return (
    <div
      className="w-[320px] shrink-0 rounded-xl p-5"
      style={glassStyle}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
          style={{ background: "var(--accent)", color: "#ffffff" }}
        >
          {initials}
        </div>
        <div>
          <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
            {name}
          </p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {role}
          </p>
        </div>
      </div>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--foreground)" }}
      >
        &ldquo;{quote}&rdquo;
      </p>
    </div>
  );
}

function MarqueeRow({
  items,
  direction,
}: {
  items: typeof testimonials.row1;
  direction: "left" | "right";
}) {
  const animClass =
    direction === "left" ? "animate-marquee-left" : "animate-marquee-right";

  const repeated = [...items, ...items, ...items, ...items];

  return (
    <div className="overflow-hidden w-full py-2">
      <div className={`flex gap-4 w-max ${animClass}`}>
        {repeated.map((item, i) => (
          <TestimonialCard key={`${item.name}-${i}`} {...item} />
        ))}
      </div>
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="py-16 sm:py-[12vh] overflow-x-clip">
      <div className="text-center mb-12 px-4">
        <h2
          className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-[-1px] leading-[1.05]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          What People Are Saying
        </h2>
      </div>

      <div className="relative pause-on-hover">
        <div
          className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, var(--background), transparent)",
          }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to left, var(--background), transparent)",
          }}
        />

        <div className="space-y-1">
          <MarqueeRow items={testimonials.row1} direction="left" />
          <MarqueeRow items={testimonials.row2} direction="right" />
        </div>
      </div>
    </section>
  );
}
