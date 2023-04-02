declare namespace GanmaAPI {
  declare namespace Serie {
    export interface Data {
      success: boolean;
      root: Root;
    }

    export interface Root {
      class: string;
      id: string;
      canSupport: boolean;
      alias: string;
      title: string;
      description: string;
      overview: string;
      lead: string;
      author: Author;
      series: Series;
      rectangleImage: RectangleImage;
      rectangleWithLogoImage: RectangleWithLogoImage;
      squareImage: SquareImage;
      squareWithLogoImage: SquareWithLogoImage;
      exchangeCoverImage: ExchangeCoverImage;
      flags: Flags;
      publicLatestStoryNumber: number;
      items: Item[];
      upcoming: Upcoming;
      newestStoryInformation: NewestStoryInformation;
      freeSpec: FreeSpec2;
      release: number;
      canAcceptFanLetter: boolean;
      ogp: Ogp;
      thumbnail: Thumbnail;
      coverImage: CoverImage;
      storyReleaseStatus: string;
      firstViewAdvertisements: any[];
      footerAdvertisements: any[];
    }

    export interface Author {
      class: string;
      id: string;
      profileImage: ProfileImage;
      penName: string;
      profile: string;
      link: Link;
    }

    export interface ProfileImage {
      class: string;
      url: string;
      id: string;
    }

    export interface Link {
      text: string;
      url: string;
    }

    export interface Series {
      id: string;
      title: string;
      exchangeCoverImageUrl: string;
      squareImageUrl: string;
      class: string;
    }

    export interface RectangleImage {
      class: string;
      url: string;
      id: string;
    }

    export interface RectangleWithLogoImage {
      class: string;
      url: string;
      id: string;
    }

    export interface SquareImage {
      class: string;
      url: string;
      id: string;
    }

    export interface SquareWithLogoImage {
      class: string;
      url: string;
      id: string;
    }

    export interface ExchangeCoverImage {
      class: string;
      url: string;
      id: string;
    }

    export interface Flags {
      isEveryOtherWeek?: boolean;
      isSaturday?: boolean;
      isFinish?: boolean;
    }

    export interface Item {
      class: string;
      storyEnd: StoryEnd;
      subtitle: string;
      releaseStart: number;
      releaseForFree: number;
      kind: string;
      id: string;
      series: Series2;
      author: Author2;
      title: string;
      page: Page;
      afterwordImage?: AfterwordImage;
      disableCM: boolean;
      storyThumbnail: StoryThumbnail;
      isVerticalOnly: boolean;
    }

    export interface StoryEnd {
      class: string;
      id: string;
      items: Item2[];
    }

    export interface Item2 {
      class: string;
    }

    export interface Series2 {
      id: string;
      title: string;
      exchangeCoverImageUrl: string;
      squareImageUrl: string;
      class: string;
    }

    export interface Author2 {
      class: string;
      id: string;
      profileImage: ProfileImage2;
      penName: string;
      profile: string;
    }

    export interface ProfileImage2 {
      class: string;
      url: string;
      id: string;
    }

    export interface Page {
      class: string;
      id: string;
      baseUrl: string;
      token: string;
      files: string[];
    }

    export interface AfterwordImage {
      class: string;
      url: string;
      id: string;
    }

    export interface StoryThumbnail {
      url: string;
    }

    export interface Upcoming {
      class: string;
      title: string;
      scheduledDate: number;
    }

    export interface NewestStoryInformation {
      class: string;
      exchange: boolean;
      release: number;
      freeSpec: FreeSpec;
      id: string;
      series: Series3;
      author: Author3;
      title: string;
      subTitle: string;
    }

    export interface FreeSpec {
      class: string;
      defaultFree: boolean;
      from: number;
      to: number;
    }

    export interface Series3 {
      id: string;
      title: string;
      exchangeCoverImageUrl: string;
      squareImageUrl: string;
      class: string;
    }

    export interface Author3 {
      class: string;
      id: string;
      profileImage: ProfileImage3;
      penName: string;
      profile: string;
    }

    export interface ProfileImage3 {
      class: string;
      url: string;
      id: string;
    }

    export interface FreeSpec2 {
      class: string;
      isFree: boolean;
    }

    export interface Ogp {
      imageUrl: string;
    }

    export interface Thumbnail {
      class: string;
      url: string;
      id: string;
    }

    export interface CoverImage {
      class: string;
      url: string;
      id: string;
    }
  }
}
