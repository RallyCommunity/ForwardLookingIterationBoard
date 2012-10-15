/**
 Copyright (c) 2011  Rally Software Development Corp.  All rights reserved
 */
var ForwardLookingIterationBoardCardRenderer = function(column, item) {

    rally.sdk.ui.cardboard.BasicCardRenderer.call(this, column, item);

    var that = this;

    this.renderCard = function() {
        var card = document.createElement("div");
        dojo.addClass(card, "card");
        dojo.addClass(card, rally.sdk.util.Ref.getTypeFromRef(item._ref));
        var header = document.createElement("div");
        dojo.addClass(header, "cardHeader");
        dojo.addClass(header, "dojoDndHandle");
        card.appendChild(header);

        var idDiv = document.createElement("div");
        var link = new rally.sdk.ui.basic.Link({item: item});
        link.display(idDiv);
        dojo.addClass(idDiv, "leftCardHeader");
        header.appendChild(idDiv);

        var planEstimateNode = dojo.create("span", null, idDiv);
        planEstimateNode.innerHTML = " (est: " + (item.PlanEstimate || '?') + ")";
        
        if(!item.PlanEstimate) {
            dojo.addClass(planEstimateNode, "noPlanEstimate");
        } else {
            dojo.addClass(planEstimateNode, "hasPlanEstimate");
        }

        if(item.IsPreAssigned) {
            dojo.addClass(card, "isPreAssigned");
        }

        var ownerImg = document.createElement("img");
        dojo.addClass(ownerImg, "cardOwner");
        var ownerName = document.createElement("div");
        dojo.addClass(ownerName, "cardOwnerName");

        if (item.Owner !== null) {
            ownerImg.setAttribute("src", rally.sdk.util.Ref.getUserImage(item.Owner._ref));
            ownerName.appendChild(document.createTextNode(item.Owner._refObjectName));
        }
        else {
            ownerImg.setAttribute("src", rally.sdk.loader.launcherPath + "/../images/profile-mark-18.png");
            ownerName.appendChild(document.createTextNode("No Owner"));
        }

        header.appendChild(ownerImg);
        header.appendChild(ownerName);

        var textDiv = document.createElement("div");
        dojo.addClass(textDiv, "cardContent");
        textDiv.innerHTML = item.Name;
        card.appendChild(textDiv);

        return card;
    };

    this.renderDndCard = function() {
        var avatarCard = that.renderCard();
        dojo.addClass(avatarCard, "avatar");
        return avatarCard;
    };
};
