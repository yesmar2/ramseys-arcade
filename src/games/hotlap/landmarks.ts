/*
 * Hot Lap's landmarks: real circuits brought down to the arcade's size, each put on a day of the plan with
 * `node scripts/hotlap-daily.mjs insert YYYY-MM-DD <key>`. A landmark is its circuit's corners in order,
 * as turns and straights sized from a survey of the real one, turned to lie as it does on the map, with
 * its hills.
 */
export type Landmark = {
  name: string
  course: string
  /** Which way the front straight faces on the map, degrees from east. */
  heading: number
  /** Its heights round the lap (courses.ts decodeHills). */
  hills: string
}

export const LANDMARKS: Record<string, Landmark> = {
  /*
   * After Watkins Glen International, New York: the long course, with the Boot, at 0.4 of its size (2.1 km
   * of its 5.5), with its hills at half their height (22 m of its 45). From the start: The Ninety, down
   * into the Esses and up the hill through them, the long climb to the Bus Stop at the top, the Outer Loop
   * falling away, the Chute, turn 5 down into the Boot and the Toe at the bottom of it, the climb out, the
   * Heel, turn 9, and the fast left and turn 11 back onto the front straight.
   *
   * The line is from OpenStreetMap (© OpenStreetMap contributors, ODbL), fitted with arcs and straights to
   * within 3 m (at this size) of it, and the heights are USGS 3DEP's (public domain), smoothed over 80 m.
   */
  glen: {
    name: 'Seneca Glen',
    course:
      'A -97/27 B -72/77 18 43/86 22 -48/118 206 -43/41 41/26 6 38/37 -36/56 2 -142/50 82 141/35 108 -175/24 204 -123/28 70 128/28 94 73/44 72 -88/36',
    heading: 86.5,
    hills:
      '6:-0.2 15:-0.5 25:-0.8 35:-1.2 44:-1.6 54:-2.3 64:-3.1 73:-4 83:-5 93:-6.4 104:-7.9 113:-9.1 122:-10.2 131:-11.2 140:-12.1 149:-12.9 158:-13.4 167:-13.3 176:-12.3 185:-10.3 193:-8.1 203:-5.9 213:-4.2 223:-3.4 234:-3.1 243:-2.8 252:-2.9 261:-2.8 271:-2.6 280:-2.1 290:-1.4 299:-0.6 309:0.1 318:0.8 328:1.4 338:2 347:2.7 357:3.4 367:4.1 376:4.7 391:5.4 399:5.9 402:6.1 414:6.7 422:7.1 430:7.2 441:7 450:6.6 460:5.9 470:4.4 479:2.6 489:1.5 498:1 508:0.3 518:-0.9 527:-2.2 535:-3.5 543:-4.9 551:-6.3 559:-7.7 567:-8.9 576:-10 584:-11 593:-12.1 601:-13.2 610:-14.2 618:-14.8 625:-14.4 632:-12.9 639:-10.8 645:-8.9 652:-7.2 662:-5.7 671:-4.3 681:-3.3 690:-2.5 700:-1.8 709:-1.4 719:-1.1 728:-1 738:-1.1 748:-1.4 757:-1.9 766:-2.5 776:-3.3 787:-4 797:-3.3 808:-1.5 818:0.1 828:0.7 838:0.7 846:0.6 855:0.2 864:0.4 873:0.9 882:1.1 890:1.3 899:1.5 908:1.6 919:1.8 930:1.8 941:1.8 950:1.6 959:1.3 967:1 977:0.7 987:0.4 996:0.1',
  },
}
