declare module 'merry-timeline' {
  interface TimelineItem {
    time: number;
    color: string;
    text: string;
  }
  interface TimelineOptions {
    timezone?: string;
    width?: number;
    tracker?: number;
  }
  function timeline(
    el: HTMLElement,
    data: TimelineItem[],
    options?: TimelineOptions
  ): void;
  export default timeline;
}
