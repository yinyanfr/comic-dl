declare namespace CopymangaAPI {
  declare namespace Serie {
    export interface Data {
      code: number;
      message: string;
      results: Results;
    }

    export interface Results {
      is_lock: boolean;
      is_login: boolean;
      is_mobile_bind: boolean;
      is_vip: boolean;
      comic: Comic;
      popular: number;
      groups: Groups;
    }

    export interface Comic {
      uuid: string;
      b_404: boolean;
      b_hidden: boolean;
      name: string;
      alias: string;
      path_word: string;
      close_comment: boolean;
      close_roast: boolean;
      free_type: FreeType;
      restrict: Restrict;
      reclass: Reclass;
      females: any[];
      males: any[];
      clubs: any[];
      img_type: number;
      seo_baidu: string;
      region: Region;
      status: Status;
      author: Author[];
      theme: Theme[];
      parodies: any[];
      brief: string;
      datetime_updated: string;
      cover: string;
      last_chapter: LastChapter;
      popular: number;
    }

    export interface FreeType {
      display: string;
      value: number;
    }

    export interface Restrict {
      value: number;
      display: string;
    }

    export interface Reclass {
      value: number;
      display: string;
    }

    export interface Region {
      value: number;
      display: string;
    }

    export interface Status {
      value: number;
      display: string;
    }

    export interface Author {
      name: string;
      path_word: string;
    }

    export interface Theme {
      name: string;
      path_word: string;
    }

    export interface LastChapter {
      uuid: string;
      name: string;
    }

    export interface Groups {
      default: Default;
    }

    export interface Default {
      path_word: string;
      count: number;
      name: string;
    }
  }

  declare namespace Chapter {
    export interface Data {
      code: number;
      message: string;
      results: Results;
    }

    export interface Results {
      list: List[];
      total: number;
      limit: number;
      offset: number;
    }

    export interface List {
      index: number;
      uuid: string;
      count: number;
      ordered: number;
      size: number;
      name: string;
      comic_id: string;
      comic_path_word: string;
      group_id: any;
      group_path_word: string;
      type: number;
      img_type: number;
      news: string;
      datetime_created: string;
      prev?: string;
      next?: string;
    }
  }

  declare namespace Images {
    export interface Data {
      code: number;
      message: string;
      results: Results;
    }

    export interface Results {
      show_app: boolean;
      is_lock: boolean;
      is_login: boolean;
      is_mobile_bind: boolean;
      is_vip: boolean;
      comic: Comic;
      chapter: Chapter;
    }

    export interface Comic {
      name: string;
      uuid: string;
      path_word: string;
      restrict: Restrict;
    }

    export interface Restrict {
      value: number;
      display: string;
    }

    export interface Chapter {
      index: number;
      uuid: string;
      count: number;
      ordered: number;
      size: number;
      name: string;
      comic_id: string;
      comic_path_word: string;
      group_id: any;
      group_path_word: string;
      type: number;
      img_type: number;
      news: string;
      datetime_created: string;
      prev: string;
      next: string;
      contents: Content[];
      words: number[];
      is_long: boolean;
    }

    export interface Content {
      url: string;
    }
  }
}
