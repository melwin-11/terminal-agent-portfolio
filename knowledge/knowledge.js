export const about = {
  summary:
    "Melwin Robinson is a B.Tech student in Computer Engineering (Artificial Intelligence and Machine Learning, with Honours in Data Science) at Christ (Deemed to be University), based in Bengaluru, Karnataka, India. He works as a Software Developer Intern at Coding4Community and is seeking AI Engineer and Software Engineer (SWE/SDE) roles. His research interests include AI, novel model architectures, and domain-specific AI systems.",
  status:
    "Currently a Software Developer Intern at Coding4Community and studying toward a B.Tech, expected to graduate in June 2027. Melwin is seeking AI Engineer and Software Engineer (SWE/SDE) roles, research opportunities in AI, and academic mentorship. His notice period is 0 days and he is available to join immediately. Work authorization details are not listed; contact Melwin by email for those details.",
  research_interests: ["Artificial intelligence", "Novel AI architectures", "Domain-specific AI systems"],
};

export const links = {
  website: "https://melwinrobinson.xyz",
  linkedin: "https://www.linkedin.com/in/melwin-robinson",
  github: "https://github.com/melwin-11",
  orcid: "https://orcid.org/0009-0001-6179-6829",
  email: "melwin.11.robinson@gmail.com",
};

export const experience = [
  {
    org: "Coding4Community",
    role: "Software Developer Intern",
    type: "internship",
    start: "2026-04",
    end: null,
    location: "Trivandrum",
    summary: "Melwin built and deployed the Coding4Community website and is developing cross-platform iOS and Android travel apps for a client.",
    highlights: [
      "Built and deployed coding4community.in with React, Vite, Supabase, and Vercel, contributing from requirements through testing, debugging, deployment, and maintenance.",
      "Developing iOS and Android travel apps with React Native and Expo, integrating Clerk authentication, Supabase, and Node.js scripts, with testing and performance optimization.",
    ],
    tech: ["React", "Vite", "Supabase", "Vercel", "React Native", "Expo", "Clerk", "Node.js"],
    url: "https://coding4community.in",
  },
  {
    org: "Centre for Development of Telematics (C-DOT)",
    role: "RAN (Radio Access Network) Testing Intern",
    type: "internship",
    start: "2025-04",
    end: "2025-05",
    location: "Bengaluru",
    summary: "Automated deployment and tested radio access network services on private cloud infrastructure.",
    highlights: [
      "Automated deployment of RAN testing services on private cloud infrastructure using Ansible playbooks, wrote Bash scripts for production support, and built a testing GUI with React and Express.js.",
      "Maintained and analyzed testing logs to debug issues and validated network strength and performance across varied conditions.",
    ],
    tech: ["Ansible", "Bash", "React", "Express.js", "private cloud"],
    url: "",
  },
];

export const education = [
  {
    school: "Christ (Deemed to be University)",
    degree: "B.Tech in Computer Engineering in Artificial Intelligence and Machine Learning",
    honours: "Data Science",
    location: "Bengaluru",
    end: null,
    expected_graduation: "2027-06",
    grade: "CGPA: 3.83/4.0",
    highlights: ["Received the Hana Scholarship from the Hana Nanum Foundation (Hana Financial Group) in 2024 and 2026, $500 each year ($1,000 total), for academic merit."],
  },
  {
    school: "Christ Junior College",
    degree: "Class 12 (Pre-University)",
    location: "Bengaluru",
    grade: "88%",
  },
  {
    school: "Christ School",
    degree: "Class 10 (ICSE)",
    location: "Bengaluru",
    grade: "94%",
  },
];

export const projects = [
  {
    name: "Home Server and Self-Hosted Media Cloud",
    summary:
      "Repurposed a Lenovo ThinkCentre Tiny with a 7th-generation Intel Core i3 T-series processor (3.40 GHz), 16 GB RAM, a 512 GB SSD, and a 1 TB HDD into an always-on home server for private photo and video storage and family media streaming.",
    status: "active home lab",
    highlights: [
      "Runs Jellyfin, an open-source media server, so family members can stream entertainment to the TV.",
      "Provides private, self-hosted cloud storage for personal photos and videos.",
      "Uses Tailscale for remote access and a UPS for backup power.",
      "Uses firewall rules to control which network traffic can reach the server and limit unnecessary exposure.",
    ],
    tech: ["Lenovo ThinkCentre Tiny", "Intel Core i3 7th-generation T-series", "16 GB RAM", "512 GB SSD", "1 TB HDD", "Jellyfin", "Tailscale", "UPS", "Firewall"],
    url: "",
  },
  {
    name: "ODIN Home-Lab Monitor",
    summary:
      "A native iOS home-server monitoring app built with SwiftUI on an AWS EC2 Mac M4 Metal instance. It monitors server resources, tracks running services, and supports remote service lifecycle management.",
    status: "developed; home-lab project",
    highlights: [
      "Monitors home-server resources and service status, with remote controls for managing service lifecycles.",
      "Supports on-demand deployment of services from preconfigured server images, remote start and stop controls, and FTP-based file transfers.",
      "Built and tested on an AWS EC2 Mac M4 Metal environment.",
    ],
    tech: ["Swift", "SwiftUI", "iOS", "AWS EC2 Mac M4 Metal", "FTP"],
    url: "",
  },
  {
    name: "Terminal Portfolio Agent",
    summary:
      "An LLM-powered terminal agent that answers recruiter questions using read-only profile tools. The updated resume describes a LangChain and LangGraph implementation, packaged as the npx melwin-portfolio command and deployed on Cloudflare Workers with LangSmith observability.",
    status: "deployed; active development",
    highlights: [
      "Built an LLM-powered agent with LangChain and LangGraph that uses read-only profile tools to answer recruiter questions, packaged for use with npx melwin-portfolio.",
      "Deployed on Cloudflare Workers with request limits, Cloudflare D1 trace storage, LangSmith observability, model fallback, and prompt-injection checks.",
    ],
    tech: ["JavaScript", "Node.js", "LangChain", "LangGraph", "Cloudflare Workers", "Cloudflare D1", "LangSmith"],
    url: "https://github.com/melwin-11/terminal-agent-portfolio",
    source_code: "https://github.com/melwin-11/terminal-agent-portfolio",
  },
  {
    name: "Department Website",
    summary:
      "Built the website for the Department of Artificial Intelligence and Machine Learning at Christ (Deemed to be University), earning second place and an INR 3,000 cash prize.",
    status: "completed",
    highlights: [
      "Led development with the MERN stack, refining front-end and back-end features, debugging, and deployment.",
      "Deployed the site on Vercel and Render to provide reliable access to department resources.",
    ],
    tech: ["MongoDB", "Express.js", "React", "Node.js", "Vercel", "Render"],
    url: "",
  },
];

export const research = [
  {
    title: "Data-Driven Insights for Intelligent Ride Service Recommendations with FairFareAI on Indian Roads",
    kind: "paper",
    status: "published",
    date: "2026",
    venue:
      "Proceedings of the 6th International Conference on Computational Intelligence (ICCI 2025), Springer Nature, Lecture Notes in Networks and Systems, volume 2063, pages 230–241",
    summary:
      "Introduces FairFareAI for ride-hailing fare prediction and surge-multiplier estimation across Bengaluru wards, using a synthetic dataset. The study evaluates linear and tree-based regression methods; Random Forest performed best in the reported experiments (MSE 10.99, R² 99.96), with the goal of improving fare transparency and surge management during emergencies.",
    url: "https://link.springer.com/chapter/10.1007/978-3-032-31523-6_18",
  },
  {
    title: "Automated-Pneumonia Diagnosis via SOTA Image Classifiers",
    kind: "conference presentation",
    status: "presented; publication pending",
    venue: "2nd International Conference on Smart Technology and Artificial Intelligence (STAI 2026), Fremont, California, United States",
    summary:
      "Compared state-of-the-art image classifiers for pneumonia detection from chest X-rays on accuracy, sensitivity and specificity, identifying CNNs as the most balanced model. Built with Python and TensorFlow on NVIDIA T4 GPUs.",
    url: "https://drive.google.com/file/d/1GHKMu7sCts2FZ7LB4zDq5KQDZzg_VWrt/view",
  },
  {
    title: "Emerging Technologies and Environmental Impact of Electric and Hybrid Electric Vehicles: A Comprehensive Data Analysis",
    kind: "book chapter",
    status: "forthcoming; book in production",
    date: "2027-10",
    venue: "Artificial Intelligence for Next-Gen Green Vehicles: Driving Toward a Sustainable Future, Apple Academic Press",
    summary:
      "Co-authored book chapter examining emerging electric and hybrid-electric vehicle technologies and their environmental impacts through a comprehensive data-analysis lens. The publisher lists the book as in production with an expected October 2027 publication.",
    url: "https://www.appleacademicpress.com/artificial-intelligence-for-next-gen-green-vehicles-driving-toward-a-sustainable-future/9781779649539",
  },
  {
    title: "Adaptive Multi-Agent Digital Forensics Through LLM-Based Tool Routing and Evidence-Grounded Reasoning",
    kind: "conference paper",
    status: "scheduled for presentation at SCIS 2026; publication status pending",
    date: "2026-11",
    venue: "3rd International Conference on Sustainable Computing and Intelligent Systems (SCIS 2026), organized by the University of Canberra and Soft Computing Research Society",
    summary:
      "A multi-agent digital-forensics system that routes investigation inquiries to appropriate tools and grounds responses in evidence, with the aim of improving accuracy and reliability. The official program lists the paper for SCIS 2026 on November 21–22, 2026.",
    authors: ["Sania Maria Raju", "Melwin Robinson", "Shiju George"],
    url: "https://www.scrs.in/conference/scis2026/page/SCIS_2026_Program_Schedule",
  },
];

export const certifications = [
  { name: "SAP Certified - Joule Studio Developer", issuer: "SAP", skills: ["AI agents", "Artificial intelligence"] },
  { name: "Oracle Cloud Infrastructure Certified Foundations Associate", issuer: "Oracle", skills: ["Oracle Cloud Infrastructure", "Cloud computing"] },
  { name: "GitHub Foundations", issuer: "GitHub", skills: ["Git", "GitHub"] },
  { name: "SAP Certified - SAP Generative AI Developer", issuer: "SAP", skills: ["Generative AI", "Cloud application development"] },
  { name: "Introduction to Data Science", issuer: "Cisco Networking Academy", skills: ["Data analysis", "Data collection"] },
  { name: "AWS Educate Introduction to Cloud 101 - Training Badge", issuer: "Amazon Web Services", skills: ["AWS", "Cloud computing"] },
  { name: "Networking Basics", issuer: "Cisco Networking Academy", skills: ["Computer networking", "Cisco networking"] },
  { name: "AWS Academy Graduate - AWS Academy Cloud Foundations", issuer: "Amazon Web Services", skills: ["Cloud computing", "AWS"] },
  { name: "The Complete Full-Stack Web Development Bootcamp", issuer: "Udemy", skills: ["Full-stack web development"] },
  { name: "AWS Certified AI Practitioner", issuer: "Amazon Web Services", status: "in progress", skills: ["Artificial intelligence", "AWS"] },
  { name: "Claude Certified Architect", issuer: "Anthropic", status: "in progress; certification level not specified", skills: ["AI architecture", "Claude"] },
];

export const skills = {
  languages: ["C", "Java", "Python", "HTML5", "JavaScript", "TypeScript", "SQL", "Bash"],
  developer_tools: ["Git", "GitHub", "Docker", "Postman", "MongoDB", "PostgreSQL", "Supabase", "MySQL"],
  libraries_and_frameworks: ["React", "Express.js", "Node.js", "scikit-learn", "NumPy", "PyTorch", "OpenCV", "FastAPI"],
  cloud_and_devops: ["AWS (EC2, IAM, S3)", "GitHub Actions", "Vercel", "Railway", "Prometheus", "Grafana"],
  soft_skills: ["Leadership", "Adaptability", "Communication", "Problem-Solving"],
};
