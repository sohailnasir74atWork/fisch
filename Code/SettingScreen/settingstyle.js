import { StyleSheet } from "react-native";
import config from "../Helper/Environment";
import { STATUS } from '../Design/tokens';
import { getThemeColors } from '../Helper/themeColors';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';

export const getStyles = (isDarkMode, c = getThemeColors(isDarkMode)) =>
    StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: isDarkMode ? config.colors.backgroundDark : '#f4f5f7',
        padding: SPACE.md,
      },
      cardContainer: {
        backgroundColor: isDarkMode ? config.colors.surfaceDark : '#ffffff',
        borderRadius: 10,
        // paddingVertical: 1,
        paddingHorizontal:5,
        marginBottom: SPACE.lg,
      },
      optionuserName: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        // borderBottomWidth:1,
        // borderBottomColor:'grey',
        paddingVertical:5,
      },
      profileImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: SPACE.lg,
        backgroundColor:'white'

      },
      profileImage2: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: SPACE.lg,
        backgroundColor:'white'
      },
      userName: {
        fontSize: SIZE.subtitle,
        fontFamily:FONT.bold,
        color: c.text,
        lineHeight:24

      },
      userNameLogout: {
        fontSize: SIZE.subtitle,
        fontFamily:FONT.bold,
        color: config.colors.secondary,
        lineHeight:24
      },
      reward: {
        fontSize: SIZE.body,
        color: c.textSecondary,
        fontFamily:FONT.regular
      },
      rewardLogout: {
        fontSize: SIZE.caption,
        color: c.textSecondary,
        fontFamily:FONT.regular,
        overflow:'hidden',
        width:250,
        flexWrap:'wrap'
      },
      option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: SPACE.md,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      },
      optionLast: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: SPACE.md,
        borderBottomColor: c.border,
      },
      optionText: {
        fontSize: SIZE.body,
        marginLeft: SPACE.lg,
        color: c.text,
        fontFamily:FONT.regular,
        lineHeight:24
      },
      overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
      },
      drawer: {
        backgroundColor: isDarkMode ? config.colors.surfaceDark : '#ffffff',
        padding: SPACE.xxl,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: c.shadow,
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      drawerTitle: {
        fontSize: SIZE.subtitle,
        marginBottom: 15,
        fontFamily:FONT.bold

      },
     
      input: {
        backgroundColor: isDarkMode ? config.colors.backgroundDark : '#f4f5f7',
        padding: SPACE.lg,
        borderRadius: 5,
        marginBottom: SPACE.xxxl,
        color: c.text,
      },
      imageOption: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginHorizontal: SPACE.lg,
        borderWidth: 2,
        borderColor: STATUS.primary,
      },
      saveButton: {
        backgroundColor: config.colors.primary,
        paddingVertical: 15,
        borderRadius: 10,
        marginTop: SPACE.lg,
      },
      saveButtonText: {
        color: c.textInverse,
        textAlign: 'center',
      },
      saveButtonProfile: {
        borderWidth:2,
        borderColor: config.colors.primary,
        paddingVertical: 15,
        borderRadius: 20,
        marginTop: SPACE.xxxl,
      },
      saveButtonTextProfile: {
        // color: c.textInverse,
        textAlign: 'center',
      },
      drawerSubtitle:{
        color: c.text,
        fontFamily:FONT.bold,
        marginBottom:5
      },
      drawerSubtitleUser:{
        color: c.text,
        fontFamily:FONT.bold,
        // marginBottom: SPACE.lg
      },
      subtitle:{
        color: c.text,
        fontFamily:FONT.bold,
        marginVertical: SPACE.lg
      },
      rewardDescription:{
        color: c.text,
        fontFamily:FONT.regular,
        fontSize: SIZE.caption

      },
      optionTextLogout:{
        fontSize: SIZE.body,
        lineHeight:16,
        marginLeft: SPACE.lg,
        color:config.colors.wantBlockRed,
        fontFamily:FONT.regular
      },
      optionTextDelete:{
        fontSize: SIZE.subtitle,
        marginLeft: SPACE.lg,
        color:!isDarkMode ? '#5A1F1F' : '#FFE5E5',
        fontFamily:FONT.regular

      },
      optionDelete: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomColor: c.border,
        backgroundColor: c.bgAlt,
        fontFamily:FONT.regular

      },
      containertheme:{
        flexDirection:'row',
        borderWidth:1,
        borderRadius:50,
        borderColor: config.colors.hasBlockGreen,
      },
      box: {
        paddingVertical: 7,
        paddingHorizontal: SPACE.sm,
        // backgroundColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center',
        color:'white',
        fontFamily:FONT.regular,
        borderRadius:50,



      },
      selectedBox: {
        backgroundColor: config.colors.hasBlockGreen, // Highlight selected box
      },
      // text:{
      //   fontFamily:'Lato-Regular',
      //   fontSize: SIZE.caption,
      //   color: c.text,

      // },
      selectedText:{
        color:'white',
        fontFamily:FONT.regular,
        fontSize: SIZE.label,
      },
      subscriptionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACE.lg,
        paddingHorizontal: SPACE.xxxl,
        borderWidth: 1,
        borderColor: config.colors.hasBlockGreen,
        borderRadius: 8,
        marginVertical: SPACE.lg,
      },
      subscriptionText: {
        color: config.colors.hasBlockGreen,
        fontSize: SIZE.subtitle,
        fontFamily: FONT.bold,
      },
      manageButton: {
        backgroundColor: config.colors.hasBlockGreen,
        paddingVertical: SPACE.sm,
        paddingHorizontal: SPACE.xl,
        borderRadius: 6,
      },
      manageButtonText: {
        color: 'white',
        fontSize: SIZE.body,
        fontFamily: FONT.bold,
      },
      menuTrigger:{
        paddingRight: SPACE.lg
      },
      options:{
        padding:5,
        // maxWidth:100,
        borderRadius:10
      },
      option_menu:{
        padding: SPACE.lg
      },
      text: {
        fontFamily:FONT.regular,
        fontSize: SIZE.caption,
        color: c.text,
        paddingHorizontal:5
      },
      textlink: {
        fontFamily:FONT.regular,
        fontSize: SIZE.caption,
        color: c.text,
        paddingHorizontal:5,
      },
      emailText: {
        fontSize: SIZE.caption,
        color: isDarkMode ? 'lightblue' : 'blue', // Blue color to make it look like a link
        textDecorationLine: 'underline', // Underline to signify it as a link
        lineHeight:12

      },
      petsSection: {
        marginTop: SPACE.xl,
        // flexDirection: 'row',
        justifyContent: 'space-between',
        gap: SPACE.lg,
        // flex: 1,

      },
      
      petsColumn: {
        // flex: 1,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.lg
      },
      
      petsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACE.xs,
        
      },
      
      petsTitle: {
        fontSize: SIZE.body,
        fontFamily: FONT.bold,
        color: c.text,
      },
      
      petsActionText: {
        fontSize: SIZE.small,
        fontFamily: FONT.regular,
        color: '#4A90E2',
      },
      
      petsEmptyText: {
        fontSize: SIZE.small,
        color: c.textSecondary,
      },
      
      petsAvatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACE.xs,
        marginTop: SPACE.hair,
      },
      
      petBubble: {
        width: 28,
        height: 28,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: c.border,
      },
      
      petImageSmall: {
        width: '100%',
        height: '100%',
      },
      
      moreBubble: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
      },
      
      moreBubbleText: {
        fontSize: SIZE.small,
        fontFamily: FONT.bold,
        color: c.text,
      },
      imageOptionWrapper: {
        marginRight: SPACE.md,
        padding: SPACE.hair,
        borderRadius: 999,
      },
      imageOptionSelected: {
        borderWidth: 2,
        borderColor: STATUS.success,
      },
      imageOption: {
        width: 48,
        height: 48,
        borderRadius: 24,
      },
      reviewsSection: {
        marginTop: SPACE.xl,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.lg,
      },
      reviewsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACE.xl,
      },
      reviewsTitle: {
        fontSize: SIZE.caption,
        fontFamily: FONT.bold,
        color: c.text,
      },
      reviewsList: {
        maxHeight: 200,
      },
      reviewItem: {
        backgroundColor: isDarkMode ? config.colors.surfaceDark : '#f5f5f5',
        borderRadius: 8,
        padding: SPACE.xl,
        marginBottom: SPACE.lg,
      },
      reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACE.md,
      },
      reviewHeaderLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
      },
      reviewUserName: {
        fontSize: SIZE.body,
        fontFamily: FONT.regular,
        color: c.text,
        marginRight: SPACE.md,
      },
      reviewRating: {
        flexDirection: 'row',
        marginRight: SPACE.md,
      },
      editedBadge: {
        fontSize: SIZE.label,
        color: c.textSecondary,
        fontStyle: 'italic',
      },
      editButton: {
        padding: SPACE.xs,
      },
      reviewText: {
        fontSize: SIZE.caption,
        color: isDarkMode ? '#E5E7EB' : config.colors.surfaceElevatedDark,
        marginBottom: SPACE.sm,
        lineHeight: 18,
      },
      reviewDate: {
        fontSize: SIZE.small,
        color: c.textSecondary,
      },
      reviewsEmptyText: {
        fontSize: SIZE.small,
        color: c.textSecondary,
        textAlign: 'center',
        marginVertical: SPACE.xxxl,
      },
      loadMoreButton: {
        paddingVertical: SPACE.xl,
        paddingHorizontal: SPACE.xxxl,
        borderRadius: 8,
        backgroundColor: config.colors.primary,
        alignItems: 'center',
        marginTop: SPACE.lg,
        marginBottom: SPACE.lg,
      },
      loadMoreText: {
        fontSize: SIZE.body,
        fontFamily: FONT.bold,
        color: c.textInverse,
      },
    });
  