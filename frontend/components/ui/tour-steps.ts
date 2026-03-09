
export const tourOptions = {
  defaultStepOptions: {
    cancelIcon: {
      enabled: true
    },
    classes: 'axiom-liquid-glass-tour shepherd-element !max-w-[90vw] md:!max-w-md mx-auto my-auto',
    scrollTo: { behavior: 'smooth', block: 'center' } as ScrollIntoViewOptions,
    modalOverlayOpeningPadding: 10,
    modalOverlayOpeningRadius: 25
  },
  useModalOverlay: true
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getResponsiveAttach = (desktopElement: string, desktopOn: string) => {
  return window.innerWidth < 1024 ? undefined : { element: desktopElement, on: desktopOn };
};

const getSidebarAttach = (id: string) => {
  return window.innerWidth < 1024 ? undefined : { element: id, on: 'right' };
};

export const defaultSteps = (router: any) => [
  {
    id: 'welcome',
    title: "Welcome to Realtors' Practice! 🏠",
    text: "Let us give you a quick tour of the platform. You can skip at any time.",
    buttons: [
      { classes: 'shepherd-button-secondary', text: 'Exit', action: function(this: ShepherdTour) { this.cancel(); } },
      { classes: 'shepherd-button-primary', text: "Let's Go! 🚀", action: function(this: ShepherdTour) { this.next(); } },
      { classes: 'shepherd-button-skip', text: 'Skip Tour', action: function(this: ShepherdTour) { this.cancel(); } }
    ]
  },
  {
    id: 'sidebar',
    title: 'Navigation Sidebar 🧭',
    text: 'Hover or click to expand the sidebar. Access all major sections from here — Dashboard, Properties, Scraper, Search, and more.',
    attachTo: getSidebarAttach("[data-tour='sidebar']"),
    buttons: [
      { classes: 'shepherd-button-secondary', text: 'Back', action: function(this: ShepherdTour) { this.back(); } },
      { classes: 'shepherd-button-primary', text: 'Next', action: function(this: ShepherdTour) { this.next(); } },
      { classes: 'shepherd-button-skip', text: 'Skip Tour', action: function(this: ShepherdTour) { this.cancel(); } }
    ]
  },
  {
    id: 'kpi-cards',
    title: 'Key Performance Indicators 📊',
    text: 'See your property stats at a glance — total listings, for-sale, for-rent, and portfolio value.',
    attachTo: getResponsiveAttach("[data-tour='kpi-cards']", 'bottom'),
    scrollTo: { behavior: 'smooth', block: 'center' },
    buttons: [
      { classes: 'shepherd-button-secondary', text: 'Back', action: function(this: ShepherdTour) { this.back(); } },
      { classes: 'shepherd-button-primary', text: 'Next', action: function(this: ShepherdTour) { this.next(); } },
      { classes: 'shepherd-button-skip', text: 'Skip Tour', action: function(this: ShepherdTour) { this.cancel(); } }
    ]
  },
  {
    id: 'category-chart',
    title: 'Category Breakdown 📈',
    text: 'Visualise how your properties are distributed across residential, commercial, land, and more.',
    attachTo: getResponsiveAttach("[data-tour='category-chart']", 'top'),
    scrollTo: { behavior: 'smooth', block: 'center' },
    buttons: [
      { classes: 'shepherd-button-secondary', text: 'Back', action: function(this: ShepherdTour) { this.back(); } },
      { classes: 'shepherd-button-primary', text: 'Next', action: function(this: ShepherdTour) { this.next(); } },
      { classes: 'shepherd-button-skip', text: 'Skip Tour', action: function(this: ShepherdTour) { this.cancel(); } }
    ]
  },
  {
    id: 'explore-section',
    title: 'Explore Properties 🏡',
    text: 'Browse your latest property cards, switch between sale and rent views, and click any card to see full details.',
    attachTo: getResponsiveAttach("[data-tour='explore-section']", 'top'),
    scrollTo: { behavior: 'smooth', block: 'center' },
    buttons: [
      { classes: 'shepherd-button-secondary', text: 'Back', action: function(this: ShepherdTour) { this.back(); } },
      { classes: 'shepherd-button-primary', text: 'Next', action: function(this: ShepherdTour) { this.next(); } },
      { classes: 'shepherd-button-skip', text: 'Skip Tour', action: function(this: ShepherdTour) { this.cancel(); } }
    ]
  },
  {
    id: 'finish',
    title: "You're all set! 🎉",
    text: "That's the basics. Explore the sidebar to find Properties, Search, Settings, and more. Happy hunting!",
    buttons: [
      { classes: 'shepherd-button-secondary', text: 'Back', action: function(this: ShepherdTour) { this.back(); } },
      { classes: 'shepherd-button-primary', text: 'Done!', action: function(this: ShepherdTour) { this.complete(); } },
      { classes: 'shepherd-button-skip', text: 'Skip Tour', action: function(this: ShepherdTour) { this.cancel(); } }
    ]
  }
];

export interface ShepherdTour {
  back(): void;
  next(): void;
  cancel(): void;
  complete(): void;
  start(): void;
  on(event: string, handler: (data: unknown) => void): void;
  steps: unknown[];
  getElement(): HTMLElement | undefined;
}
