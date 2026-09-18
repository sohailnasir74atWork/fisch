import { StyleSheet } from "react-native";
import config from "../Helper/Environment";
import { ABOVE_CHAT_INPUT, FLOATING_BUTTON_ICON_SIZE, FLOATING_BUTTON_RIGHT } from "../Helper/floatingButtonLayout";
import { STATUS } from '../Design/tokens';
import { getThemeColors } from '../Helper/themeColors';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';

export const getStyles = (isDarkMode, c = getThemeColors(isDarkMode)) =>

  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? config.colors.backgroundDark : '#f2f2f7',
    },
    loader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chatList: {
      flexGrow: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: SPACE.sm,
      paddingVertical: 5,
    },
    mymessageBubble: {
      flexDirection: "row-reverse",
      marginBottom: SPACE.xl,
      alignItems: 'flex-end',
    },
    othermessageBubble: {
      flexDirection: 'row',
      marginBottom: SPACE.xl,
      alignItems: 'flex-start',
    },
    myBubbleContent: {
      backgroundColor: c.bgAlt,
      borderRadius: 18,
      borderTopRightRadius: 4,
      paddingHorizontal: SPACE.xl,
      paddingVertical: SPACE.lg,
    },
    otherBubbleContent: {
      backgroundColor: isDarkMode ? config.colors.surfaceDark : '#E5E5EA',
      borderRadius: 18,
      borderTopLeftRadius: 4,
      paddingHorizontal: SPACE.xl,
      paddingVertical: SPACE.lg,
    },
    bubbleInner: {
      flexDirection: 'column',
    },
    myMessage: {
      alignSelf: 'flex-end',
    },
    otherMessage: {
      alignSelf: 'flex-start',

    },
    // Avatar slot in a chat row. Must NOT constrain width/height or set a
    // borderRadius: FramedAvatar paints an SVG larger than its avatarSize
    // (border + gap + room for crowns/wings) and needs overflow visible. The
    // old fixed 34x32 + borderRadius:16 box clipped every frame's decorations.
    senderName: {
      marginBottom: SPACE.hair,
      marginHorizontal: 5,
    },
    senderNameText: {
      fontSize: SIZE.small,
      fontFamily: FONT.bold,
      color: 'grey',
    },
    messageTextBox: {
      maxWidth: '82%',
      marginHorizontal: SPACE.md,
    },
    messageTextBoxAdmin: {
      flexDirection: 'column',
      flex: 1,

    },
    myMessageText: {
      fontSize: SIZE.caption,
      color: isDarkMode ? 'white' : 'black',
      fontFamily: FONT.regular,
      lineHeight: 18,
    },
    otherMessageText: {
      fontSize: SIZE.caption,
      color: isDarkMode ? 'white' : 'black',
      fontFamily: FONT.regular,
      lineHeight: 18,
    },
    myMessageTextOnly: {
      fontSize: SIZE.body,
      color: c.text,
      fontFamily: FONT.regular,
      lineHeight: 18,
      textAlign: 'left',
    },
    otherMessageTextOnly: {
      fontSize: SIZE.body,
      color: c.text,
      fontFamily: FONT.regular,
      lineHeight: 18,
      textAlign: 'left',
    },
    timestamp: {
      fontSize: SIZE.label,
      color: isDarkMode ? 'lightgrey' : 'grey',
      textAlign: 'right',
      paddingHorizontal: 5
    },
    input: {
      flex: 1, // Ensures the input takes available space
      borderRadius: 20,
      padding: 5,
      marginRight: SPACE.lg,
      fontSize: SIZE.subtitle,
      minHeight: 30, // ✅ Fixed typo: heighteight -> minHeight
      maxHeight: 120, // Limit input growth to a max height
      textAlignVertical: 'top', // Ensures text starts at the top
      backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
    },

    // sendButton: {
    //   borderRadius: 20,
    //   // paddingVertical: SPACE.lg,
    //   paddingHorizontal: SPACE.xxxl,
    //   // backgroundColor:config.colors.primary
    // },
    // sendButtonText: {
    //   color: c.textInverse,
    //   fontSize: SIZE.subtitle,
    //   fontFamily: 'Lato-Bold',
    // },
    loggedOutMessage: {
      flex: 1,
      fontSize: SIZE.subtitle,
      paddingVertical: SPACE.lg,
    },
    loggedOutMessageText: {
      color: c.textMuted,
      textAlign: 'center',
    },
    dateSeparator: {
      fontSize: SIZE.body,
      color: c.textSecondary,
      textAlign: 'center',
      marginVertical: SPACE.lg,
    },

    platformText: {
      color: 'white',
      fontSize: SIZE.label,
      fontFamily: FONT.bold,
    },
   
    admin: {
      // alignSelf: 'flex-start',
      color: 'white',
      // fontSize: SIZE.label,
      fontFamily: FONT.bold,
      // color: config.colors.primary,
      fontSize: SIZE.label,
    },
    verifiedContainer: {
      backgroundColor: STATUS.success,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 3,
      marginLeft: SPACE.xs,
    },
    verified: {
      color: 'white',
      fontSize: SIZE.label,
      fontFamily: FONT.bold,
      // lineHeight:10,

      
    },
    adminText: {
      fontSize: SIZE.caption,
      color: 'white',
      paddingTop: 5
    },
    login: {
      height: 40,
      justifyContent: 'center',
      color: config.colors.hasBlockGreen,
      alignSelf: 'center',
      width: '100%',
      borderTopWidth: 1,
      borderColor: c.border,

      //  borderRadius:10

    },
    loginText: {
      color: config.colors.hasBlockGreen,
      fontFamily: FONT.bold,
      textAlign: 'center',
      lineHeight: 24

    },
    inputWrapper: {
      paddingHorizontal: SPACE.lg,
      paddingVertical:3,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? config.colors.borderDark : '#ddd',
      backgroundColor: isDarkMode ? config.colors.backgroundDark : config.colors.backgroundLight,
    },
    cancelReplyButton: {
      alignSelf: 'flex-end',

    },
    cancelReplyText: {
      color: STATUS.danger,
      fontSize: SIZE.caption,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? config.colors.backgroundDark : config.colors.backgroundLight,
    },
    // input: {
    //   flex: 1,
    //   backgroundColor: c.bgAlt,
    //   borderRadius: 20,
    //   paddingHorizontal: 15,
    //   paddingVertical: SPACE.lg,
    //   fontSize: SIZE.subtitle,
    // },
    sendButton: {
      marginLeft: 5,
      borderRadius: 20,
      paddingHorizontal: SPACE.xxxl,
      paddingVertical: 5,
    },
    sendButtonText: {
      color: c.textInverse,
      fontSize: SIZE.subtitle,
    },
    replyContainer: {
      backgroundColor: isDarkMode ? config.colors.surfaceDark : '#f0f0f0',
      borderLeftWidth: 3,
      borderLeftColor: isDarkMode ? STATUS.primary : STATUS.primary,
      padding: 5,
      marginBottom: 5,
      borderRadius: 5,
    },
    replyText: {
      fontSize: SIZE.label,
      color: isDarkMode ? STATUS.primary : STATUS.primary,
      width: '95%'

    },
    replySenderText: {
      fontSize: SIZE.caption,
      fontFamily: FONT.bold,
      color: c.text,
    },
    profileImage: {
      height: 34,
      width: 34,
      borderRadius: 17,
      backgroundColor:'white'
    },
    profileImagePvtChat: {
      height: 30,
      width: 30,
      borderRadius: 15,
      marginHorizontal: 5,
      backgroundColor:'white'
    },

    userName: {
      color: isDarkMode ? 'lightfrey' : 'grey',
      fontSize: SIZE.label,
      justifyContent:'center',
      // backgroundColor:'red',
      backgroundColor:'red',
      lineHeight:14,
      fontFamily:FONT.bold

    },
    adminActions: {
      // flexDirection: 'row',
      justifyContent:'center',
      // alignItems:'flex-end',
      // overflow:'hidden',
      // flexWrap:"wrap"
    },
    adminTextAction: {
      backgroundColor: config.colors.wantBlockRed,
      marginHorizontal: 3,
      padding: SPACE.lg,
      borderRadius: 3,
      color: 'white',
      alignSelf: 'center',
      minWidth: 150,
      // fontSize: SIZE.label
      },
    dot: {
      color: c.textMuted,
      marginHorizontal: 5,
      fontSize: SIZE.body
    },
    linkText: {
      color: '#1E90FF', // Blue color for links
      textDecorationLine: 'underline', // Underline to indicate a link
    },
 
    menu: {
      borderRadius: 20,
      // backgroundColor:'red'
    },
    menuTrig: {
      borderRadius: 50,
      // backgroundColor: 'red',
      marginBottom: 100

    },
    menuoptions: {
      minWidth: 150,
      maxWidth: 200,
      borderRadius: 12,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#FFFFFF',
      overflow: 'hidden',
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 6,
    },
    menuOption: {
      paddingHorizontal: SPACE.xxl,
      paddingVertical: 14,
      borderBottomWidth:StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#FFFFFF',
      justifyContent: 'center',
    },
    menuOptionText: {
      fontSize: SIZE.body,
      fontFamily: FONT.regular,
      color: c.text,
    },
    menuOptionTextDanger: {
      fontSize: SIZE.body,
      fontFamily: FONT.regular,
      color: isDarkMode ? '#F87171' : STATUS.danger,
    },
    reportIcon:{
      position:'absolute',
      right:2,
      top:2,
      opacity:1,
      color:config.colors.wantBlockRed,
      fontSize: SIZE.label,
      fontStyle:'italic'

    },
    reportedMessage: {
      opacity: .3, // Light blue color
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      // backgroundColor:'red'

    },
    emptyText:{
      color: isDarkMode ? 'white' : 'black',
    },
    // Shown above the input when a chat-availability switch closes this door.
    chatUnavailableBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgAlt,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingVertical: SPACE.lg,
      paddingHorizontal: SPACE.xl,
    },
    chatUnavailableIcon: {
      fontSize: SIZE.body,
      marginRight: SPACE.md,
    },
    chatUnavailableText: {
      flex: 1,
      fontSize: SIZE.caption,
      fontFamily: FONT.bold,
      lineHeight: 17,
      color: isDarkMode ? '#fca5a5' : '#991b1b',
    },
tradeDetails: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  backgroundColor: 'grey',
  paddingHorizontal: SPACE.lg


},
itemList: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-evenly',
  width: "45%",
  paddingVertical: 0,
  // backgroundColor:'red'
},
itemImage: {
  width: 30,
  height: 30,
  // marginRight: 5,
  // borderRadius: 25,
  marginVertical: 5,
  borderRadius: 5
  // padding: SPACE.lg

},

transferImage: {
  width: 15,
  height: 15,
  // marginRight: 5,
  borderRadius: 5,
},
tradeTotals: {
  flexDirection: 'row',
  justifyContent: 'center',
  // marginTop: SPACE.lg,
  width: '100%'

},
names:{
  fontSize: SIZE.label,
  color:'white'
},
priceText: {
  fontSize: SIZE.label,
  fontFamily: FONT.regular,
  color: STATUS.primary,
  // width: '40%',
  textAlign: 'center', // Centers text within its own width
  alignSelf: 'center', // Centers within the parent container
  color: 'white', // ✅ Removed redundant conditional
  marginHorizontal: 'auto',
  paddingHorizontal: SPACE.xs,
  paddingVertical: SPACE.hair,
  borderRadius: 6
},
priceTextProfit: {
  fontSize: SIZE.label,
  lineHeight:14,
  fontFamily: FONT.regular,
  // color: STATUS.primary,
  // width: '40%',
  textAlign: 'center', // Centers text within its own width
  alignSelf: 'center', // Centers within the parent container
  // color: isDarkMode ? 'white' : "grey",
  // marginHorizontal: 'auto',
  // paddingHorizontal: SPACE.xs,
  // paddingVertical: SPACE.hair,
  // borderRadius: 6
},
tagcount: {
  position: 'absolute',
  backgroundColor: 'purple',
  top: 4,
  left: 1,
  borderRadius: 50,
  paddingHorizontal: 3,
  paddingBottom: SPACE.hair

},
tagcounttext: {
  color: 'white',
  fontFamily: FONT.bold,
  fontSize: SIZE.label
},

hasBackground: {
  backgroundColor: config.colors.hasBlockGreen,
},
wantBackground: {
  backgroundColor: config.colors.wantBlockRed,
},
tradeActions: {
  flexDirection: 'row',
  alignItems: 'center',
},

transfer: {
  width: '10%',
  justifyContent: 'center',
  alignItems: 'center'
},
deleteButton:{
  paddingVertical:5
},
chatImage: {
  width: 200,
  height: 200,
  borderRadius: 8,
  marginBottom: SPACE.xs,
},
saveButtonTextProfile:{
  color: isDarkMode ? 'white' : "black",
},
highlightedMessage: {
  backgroundColor: c.bgAlt,      // soft yellow
  borderColor: STATUS.warning,
  borderWidth: 1,
},
nameRow: {
  flexDirection: 'row',
  alignItems: 'center',      // vertical alignment (text + images)
  // justifyContent: 'center',  // center the whole row horizontally
},

userNameText: {
  color: isDarkMode ? 'lightgrey' : 'grey',
  fontSize: SIZE.label,
  lineHeight: 14,
  paddingTop: 0,
  marginBottom: SPACE.hair,
},
userNameTextMy: {
  color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
  fontSize: SIZE.label,
  lineHeight: 14,
  paddingTop: 0,
  marginBottom: SPACE.hair,
},
userNameAdmin: {
  color: 'white',
  fontSize: SIZE.label,
  lineHeight: 11,
},

icon: {
  width: 10,
  height: 10,
  marginLeft: SPACE.xs,
  // paddingBottom:5
},

adminContainer: {
  marginLeft: SPACE.xs,
  paddingHorizontal: SPACE.xs,
  paddingVertical: 1,
  borderRadius: 4,
  backgroundColor: config.colors.primary, // your choice
  alignItems: 'center',
  justifyContent: 'center',
},

platformBadge: {
  marginLeft: SPACE.sm,
  // paddingHorizontal: 3,
  // paddingVertical: 1,
  borderRadius: '50%',
  alignItems: 'center',
  justifyContent: 'center',
},
scrollToBottomButton: {
  position: 'absolute',
  // MessagesList returns a Fragment, so this offset is measured from the
  // wrapper that also holds MessageInput — NOT from the screen edge. That is
  // why it must not be set to ABOVE_BANNER to "match" the other two screens:
  // doing so would park the button on top of the text field. ABOVE_CHAT_INPUT
  // clears the input by the same 20px gap the feed and trades buttons clear
  // the banner by, so all three read as the same height.
  bottom: ABOVE_CHAT_INPUT,
  right: FLOATING_BUTTON_RIGHT,
  // The old `marginTop: -24` ("half the icon size to centre it") is gone: with
  // only `bottom` set and no `top`, a top margin does not move an absolutely
  // positioned box, and trades never had one. Removing it makes the three
  // buttons provably identical instead of only accidentally aligned.
  zIndex: 1000,
  elevation: 8, // For Android shadow
  shadowColor: c.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
},
scrollToBottomTouchable: {
  width: FLOATING_BUTTON_ICON_SIZE,
  height: FLOATING_BUTTON_ICON_SIZE,
  borderRadius: FLOATING_BUTTON_ICON_SIZE / 2,
  // padding: SPACE.xs,
  justifyContent: 'center',
  alignItems: 'center',
},

  });